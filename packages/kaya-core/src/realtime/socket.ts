import { type Socket, io } from "socket.io-client";
import type { ApiConfig } from "../api/config";
import {
  SOCKET_EVENTS,
  type ChatMessageEvent,
  type DeliveryStatusEvent,
  type DriverLocationEvent,
  type OfferAcceptedEvent,
  type OfferNewEvent,
  type OfferRejectedEvent,
  chatMessageEventSchema,
  deliveryStatusEventSchema,
  driverLocationEventSchema,
  offerAcceptedEventSchema,
  offerNewEventSchema,
  offerRejectedEventSchema,
} from "./events";

export interface SocketEventMap {
  "offer:new": OfferNewEvent;
  "offer:accepted": OfferAcceptedEvent;
  "offer:rejected": OfferRejectedEvent;
  "location:driver": DriverLocationEvent;
  "delivery:status": DeliveryStatusEvent;
  "chat:message": ChatMessageEvent;
}

const PARSERS = {
  "offer:new": offerNewEventSchema,
  "offer:accepted": offerAcceptedEventSchema,
  "offer:rejected": offerRejectedEventSchema,
  "location:driver": driverLocationEventSchema,
  "delivery:status": deliveryStatusEventSchema,
  "chat:message": chatMessageEventSchema,
} as const;

/**
 * Which joined-id set (if any) gates local dispatch of an event. See the
 * "Local room-membership filter" section of the class doc below for why this
 * exists and why `location:driver` is exempt.
 */
type RoomScope = "order" | "delivery" | "none";

const EVENT_SCOPE: { readonly [K in keyof SocketEventMap]: RoomScope } = {
  "offer:new": "order",
  "offer:accepted": "order",
  "offer:rejected": "order",
  "location:driver": "none",
  "delivery:status": "delivery",
  "chat:message": "delivery",
};

export interface SocketServiceOptions {
  /**
   * Called when an inbound payload fails schema parsing instead of being
   * dispatched to a handler. See the class doc's "Parse failures" section --
   * this replaces the old throw-in-listener behaviour. Defaults to a no-op.
   */
  onPayloadError?: (event: keyof SocketEventMap, error: unknown, rawPayload: unknown) => void;
}

/**
 * socket.io-client's `Socket#on`/`#off` overloads are keyed by a generic
 * event-name type parameter that resolves against reserved connection events
 * plus a mapped custom-events type. When the event name passed in is itself
 * still a generic (`K extends keyof SocketEventMap`, as in `on()` below)
 * TypeScript cannot resolve that conditional type at the call site and
 * rejects an otherwise-correct `(raw: unknown) => void` listener. Dispatching
 * through this narrow, untyped view of the same two methods sidesteps that
 * inference limitation without loosening the public `SocketService.on` API.
 */
interface RawEventEmitter {
  on(event: string, listener: (raw: unknown) => void): void;
  off(event: string, listener: (raw: unknown) => void): void;
}

/**
 * Thin wrapper over socket.io-client for the NestJS realtime gateway
 * (backend/src/realtime/events.gateway.ts).
 *
 * Every inbound payload is run through the matching schema from ./events
 * before it reaches a handler. That parse call does two different things at
 * two different levels, deliberately:
 *
 *  - Shape: a payload that is not the object the gateway actually sends (e.g.
 *    null, a string, an array) fails schema's `z.object()` check. It is
 *    *not* dispatched to the handler and does *not* throw -- see "Parse
 *    failures" below.
 *  - Fields: within a well-shaped object, individual fields go through the
 *    same coerce helpers (`../wire/coerce`) the rest of the package's REST
 *    models use, and degrade to a safe fallback (empty string, `new Date()`)
 *    rather than throwing. This is a deliberate departure from "reject
 *    everything imperfect": `location:driver` ticks arrive every ~5s while a
 *    driver is on a run, and a single renamed or dropped optional field
 *    should not crash the whole location stream the way a `.strict()` schema
 *    would. REST payloads get one chance per screen load; a live socket
 *    stream gets many, so the tolerance rest models rely on all package is
 *    even more valuable here, not less.
 *
 * Net effect: gross contract breaks (wrong event shape entirely) are silent
 * to the handler but reported through `onPayloadError`; small field drift
 * degrades the same way it already does everywhere else in @kaya/core.
 *
 * Parse failures:
 * socket.io-client invokes inbound-event listeners from inside its own
 * transport packet handling, not from a call site the app controls. A throw
 * from a listener is therefore an uncaught exception the app cannot wrap in
 * try/catch -- in React Native this can crash the whole app over a single
 * malformed packet. So a payload that fails shape parsing is routed to the
 * `onPayloadError(event, error, rawPayload)` callback supplied at
 * construction (a no-op by default) instead of being thrown or dispatched.
 * This is also the only behaviour coherent with the field-level leniency
 * above: a bad shape and a bad field are both "don't crash the stream",
 * just reported differently (silently coerced vs. surfaced to the callback).
 *
 * Local room-membership filter:
 * The gateway has no leave endpoint for either room kind (see `leaveDelivery`
 * and `leaveOrder` below), and `order:join` / `chat:join` are the only way to
 * enter a room in the first place -- Socket.io rooms are opt-in, nothing
 * subscribes a socket automatically. This class tracks which delivery ids and
 * order ids were joined and, for events scoped to one of those ids, drops
 * (does not dispatch) any payload whose id is not currently joined. This is a
 * *local dispatch filter only*: the underlying socket remains in the
 * server-side Socket.io room regardless (there is no way to leave it), so the
 * server still sends the payload over the wire -- this class just declines to
 * call the handler for it. Concretely:
 *   - order-scoped (`offer:new`, `offer:accepted`, `offer:rejected`): dropped
 *     unless `payload.orderId` is in the joined-order set.
 *   - delivery-scoped (`delivery:status`, `chat:message`): dropped unless
 *     `payload.deliveryId` is in the joined-delivery set.
 *   - `location:driver` is exempt and always passes through: its payload
 *     (`{ livreur_id, lat, lng, timestamp }`, see events.gateway.ts's
 *     `onLocation()`) carries no delivery id at all -- the gateway resolves
 *     the target delivery server-side from the driver's own active delivery,
 *     so there is nothing in the payload to filter on. Scoping it would
 *     require guessing, which is worse than not filtering.
 *
 * Surviving reconnects and token refreshes:
 * Room membership lives on the *server-side* Socket.io connection, not on
 * this class. Two different things can invalidate it, and both are handled:
 *   - `reconnection: true` means socket.io-client will silently reconnect
 *     the same logical socket after a network blip (common on mobile data).
 *     That reconnection is a brand new server-side connection, so the
 *     server has forgotten every room the old connection joined -- but
 *     `joinedDeliveryIds`/`joinedOrderIds` on this class still (correctly)
 *     say they're joined, and the socket.io-client `Socket` re-emits its
 *     `connect` event on every one of these automatic reconnections, not
 *     just the first handshake. So `connect()` below attaches a `connect`
 *     listener that replays `chat:join`/`order:join` for every id this class
 *     still thinks is joined, every time the transport (re)connects.
 *   - `connect()` called again (token refresh) tears down the old socket and
 *     opens a genuinely new one -- see `connect()` -- and in that case the
 *     joined-id sets are deliberately cleared, since a fresh socket really
 *     has joined nothing yet.
 *
 * `on()` handlers surviving a rebuilt socket:
 * `connect()` calling `disconnect()` first replaces `this.socket` with a new
 * `Socket` instance. A handler attached only to the *old* instance (as a
 * naive `on()` would do by closing over the socket at subscribe time) would
 * silently stop receiving anything, and its returned unsubscribe function
 * would detach from a socket that is already gone -- a no-op, not a leak,
 * but also not what the caller asked for. So every listener registered
 * through `on()` is kept in `this.listeners` for the lifetime of this
 * class, `connect()` re-attaches all of them to whatever socket it just
 * built, and the unsubscribe closure resolves `this.socket` at call time
 * (not at `on()` time) so it detaches from whichever socket is current when
 * it runs.
 */
export class SocketService {
  private socket: Socket | null = null;
  private readonly joinedDeliveryIds = new Set<string>();
  private readonly joinedOrderIds = new Set<string>();
  private readonly onPayloadError: NonNullable<SocketServiceOptions["onPayloadError"]>;
  /** Every handler registered via `on()`, replayed onto each new socket `connect()` builds. */
  private readonly listeners: Array<{ event: string; listener: (raw: unknown) => void }> = [];
  /** Handlers registered via `onConnectionChange()`. */
  private readonly connectionListeners = new Set<(connected: boolean) => void>();

  constructor(
    private readonly config: ApiConfig,
    options: SocketServiceOptions = {},
  ) {
    this.onPayloadError = options.onPayloadError ?? (() => undefined);
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Opens the connection with the current access token, targeting the bare
   * origin (`ApiConfig.socketUrl` -- no `/api/v1`; the gateway is not mounted
   * under the REST prefix). Safe to call again after a token refresh: tears
   * down and reconnects with the new token.
   */
  connect(accessToken: string): void {
    // Tears down the transport only. `disconnect()` would additionally clear
    // the joined-id sets, which is what the caller means when *they* call it,
    // but not what rebuilding the socket under a new token means.
    this.teardownSocket();
    const socket = io(this.config.socketUrl, {
      transports: ["websocket"],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
    this.socket = socket;
    // The joined-id sets are deliberately *kept*. They record what the caller
    // asked to watch, not what a particular transport happens to have joined,
    // and the `connect` handler below replays them onto the new socket. This
    // matters most on the documented token-refresh path: a driver mid-delivery
    // whose 15-minute access token expires would otherwise end up on a socket
    // that reports `connected`, fires `onConnectionChange(true)`, and receives
    // nothing -- the local filter dropping whatever did arrive -- with no
    // symptom until the screen is remounted. `disconnect()` is the only place
    // that clears them, because that is the only place the caller has said it
    // is done watching.

    // Re-attach every handler registered via on() (possibly before this
    // connect() call, possibly against a now-torn-down previous socket) --
    // see the class doc's "on() handlers surviving a rebuilt socket".
    const rawSocket = socket as unknown as RawEventEmitter;
    for (const { event, listener } of this.listeners) {
      rawSocket.on(event, listener);
    }

    socket.on("connect", () => {
      this.notifyConnectionChange(true);
      // Re-join every room this class still thinks is joined -- see the
      // class doc's "Surviving reconnects and token refreshes". This also
      // runs harmlessly on the very first connect, when both sets are empty.
      for (const deliveryId of this.joinedDeliveryIds) {
        socket.emit(SOCKET_EVENTS.joinDelivery, { delivery_id: deliveryId });
      }
      for (const orderId of this.joinedOrderIds) {
        socket.emit(SOCKET_EVENTS.joinOrder, { order_id: orderId });
      }
    });
    socket.on("disconnect", () => {
      this.notifyConnectionChange(false);
    });
    socket.on("connect_error", () => {
      this.notifyConnectionChange(false);
    });
  }

  /**
   * Closes the current transport and reports the state change. Leaves the
   * joined-id sets alone: they record what the caller asked to watch, which
   * outlives any particular socket.
   */
  private teardownSocket(): void {
    const hadSocket = this.socket !== null;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    // removeAllListeners() above strips the socket's own 'disconnect'
    // listener before it can fire, so this is reported directly instead of
    // relying on that event.
    if (hadSocket) {
      this.notifyConnectionChange(false);
    }
  }

  disconnect(): void {
    this.teardownSocket();
    // Unlike a token-refresh rebuild, an explicit disconnect means the caller
    // is done watching, so the joined ids go too.
    this.joinedDeliveryIds.clear();
    this.joinedOrderIds.clear();
  }

  /**
   * Subscribes to connection-state transitions: `true` once the transport is
   * up (initial connect and every automatic reconnection alike), `false` on
   * disconnect (explicit or otherwise) and on a failed connection attempt.
   * Intended for a "reconnecting..." banner. Does not replay the current
   * state to a handler registered after the fact -- same policy as `on()`.
   * Returns an unsubscribe function.
   */
  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionListeners.add(handler);
    return () => {
      this.connectionListeners.delete(handler);
    };
  }

  private notifyConnectionChange(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected);
      } catch {
        // Same rationale as onPayloadError below: this runs from inside
        // socket.io's own event dispatch, so a throwing listener would
        // otherwise escape as an uncaught exception.
      }
    }
  }

  /**
   * Joins the delivery's chat + tracking room. Wire event is `chat:join`
   * with a `delivery_id` key -- the gateway's `@SubscribeMessage('chat:join')`
   * handler in events.gateway.ts is the only one that unlocks
   * location:driver/chat:message/delivery:status for a given delivery. The
   * brief called this event "delivery:join"; that name does not exist on the
   * gateway.
   */
  joinDelivery(deliveryId: string): void {
    this.socket?.emit(SOCKET_EVENTS.joinDelivery, { delivery_id: deliveryId });
    this.joinedDeliveryIds.add(deliveryId);
  }

  /**
   * Not a wire operation -- events.gateway.ts has no `@SubscribeMessage`
   * handler for leaving a room, so a socket.io client cannot unilaterally
   * leave a room the server put it in; the gateway only tears delivery rooms
   * down on disconnect. What this *does* do is remove `deliveryId` from the
   * locally tracked joined-delivery set, which `on()` consults before
   * dispatching any `delivery:status`/`chat:message` payload (see the class
   * doc's "Local room-membership filter"). The socket stays in the
   * server-side room and the server keeps sending those events on the wire;
   * this method only stops this class from calling handlers for them. That
   * is a real, working fix for the cross-talk this method used to leave
   * entirely unmentioned as a silent no-op -- it is not a true room leave.
   */
  leaveDelivery(deliveryId: string): void {
    this.joinedDeliveryIds.delete(deliveryId);
  }

  /**
   * Joins the order's offer-comparison room. Wire event is `order:join`
   * with an `order_id` key -- the gateway's `@SubscribeMessage('order:join')`
   * handler (`onOrderJoin()` in events.gateway.ts) is the only one that
   * unlocks `offer:new`/`offer:accepted`/`offer:rejected` for a given order.
   * Until this is called for an order, no offer event for it will dispatch,
   * even if the socket is connected and a handler is registered via `on()`.
   */
  joinOrder(orderId: string): void {
    this.socket?.emit(SOCKET_EVENTS.joinOrder, { order_id: orderId });
    this.joinedOrderIds.add(orderId);
  }

  /**
   * Same caveat as `leaveDelivery`: the gateway has no leave handler for the
   * order room either, so this only removes `orderId` from the local
   * joined-order set that `on()` filters `offer:*` dispatch against. The
   * socket remains in the server-side order room.
   */
  leaveOrder(orderId: string): void {
    this.joinedOrderIds.delete(orderId);
  }

  /**
   * Driver-side: publishes the current position (every ~5s while on a run).
   * Wire event is `location:update` with exactly `{ lat, lng }` -- the
   * gateway resolves the target delivery itself (the driver's current
   * `in_progress` delivery, looked up server-side), so it does not read a
   * `deliveryId` field at all. The brief's payload included one; sending it
   * would have been silently ignored on the wire.
   */
  emitLocation(payload: { lat: number; lng: number }): void {
    this.socket?.emit(SOCKET_EVENTS.locationUpdate, payload);
  }

  /**
   * Client-side send for the delivery chat (server -> `@SubscribeMessage('chat:message')`
   * / `onMessage()` in events.gateway.ts, which persists the message and
   * rebroadcasts it to the delivery room). This is a genuinely live gateway
   * handler, not dead API surface: `KayaApi.sendMessage` covers the REST
   * fallback (sending while the socket is down), but the socket path is what
   * the legacy Dart client's `SocketService.sendMessage` used for the normal
   * case, and the port had dropped it. At least one of `text`/`imageUrl` must
   * be given, matching the gateway's own validation (`onMessage` drops a
   * payload with neither).
   */
  sendMessage(deliveryId: string, payload: { text?: string; imageUrl?: string } = {}): void {
    const body: { delivery_id: string; message_text?: string; image_url?: string } = {
      delivery_id: deliveryId,
    };
    if (payload.text !== undefined) body.message_text = payload.text;
    if (payload.imageUrl !== undefined) body.image_url = payload.imageUrl;
    this.socket?.emit(SOCKET_EVENTS.chatMessage, body);
  }

  /**
   * Subscribes to a typed server event. Returns an unsubscribe function.
   *
   * A payload that fails schema parsing is routed to `onPayloadError`
   * (no-op by default) and never reaches `handler` -- see the class doc's
   * "Parse failures". A well-formed payload scoped to a delivery or order
   * that has not been joined (or was joined and then left) is silently
   * dropped -- see "Local room-membership filter".
   *
   * The listener survives a socket rebuilt by `connect()` (e.g. a token
   * refresh) -- see the class doc's "on() handlers surviving a rebuilt
   * socket" -- and the returned unsubscribe function resolves the current
   * socket when it is called, not the one live at subscribe time.
   */
  on<K extends keyof SocketEventMap>(
    event: K,
    handler: (payload: SocketEventMap[K]) => void,
  ): () => void {
    const listener = (raw: unknown) => {
      let parsed: SocketEventMap[K];
      try {
        parsed = PARSERS[event].parse(raw) as SocketEventMap[K];
      } catch (err) {
        // The reporter is caller-supplied — logging or telemetry that throws
        // would escape uncaught from socket.io's transport dispatch, which is
        // the very crash this parse guard exists to prevent.
        try {
          this.onPayloadError(event, err, raw);
        } catch {
          // deliberately swallowed
        }
        return;
      }
      if (!this.isJoinedScope(event, parsed)) {
        return;
      }
      handler(parsed);
    };
    this.listeners.push({ event, listener });
    this.attachToCurrentSocket(event, listener);
    return () => {
      this.detachFromCurrentSocket(event, listener);
      const index = this.listeners.findIndex(
        (entry) => entry.event === event && entry.listener === listener,
      );
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private attachToCurrentSocket(event: string, listener: (raw: unknown) => void): void {
    const socket = this.socket as unknown as RawEventEmitter | null;
    socket?.on(event, listener);
  }

  private detachFromCurrentSocket(event: string, listener: (raw: unknown) => void): void {
    const socket = this.socket as unknown as RawEventEmitter | null;
    socket?.off(event, listener);
  }

  /** True if a parsed payload's room scope (if any) is currently joined -- see "Local room-membership filter" above. */
  private isJoinedScope<K extends keyof SocketEventMap>(event: K, parsed: SocketEventMap[K]): boolean {
    switch (EVENT_SCOPE[event]) {
      case "order":
        return this.joinedOrderIds.has((parsed as { orderId: string }).orderId);
      case "delivery":
        return this.joinedDeliveryIds.has((parsed as { deliveryId: string }).deliveryId);
      case "none":
        return true;
    }
  }
}

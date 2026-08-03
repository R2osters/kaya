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
 */
export class SocketService {
  private socket: Socket | null = null;
  private readonly joinedDeliveryIds = new Set<string>();
  private readonly joinedOrderIds = new Set<string>();
  private readonly onPayloadError: NonNullable<SocketServiceOptions["onPayloadError"]>;

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
    if (this.socket !== null) this.disconnect();
    this.socket = io(this.config.socketUrl, {
      transports: ["websocket"],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
    // A freshly opened socket is not in any room yet -- any ids joined
    // against a previous socket are no longer valid.
    this.joinedDeliveryIds.clear();
    this.joinedOrderIds.clear();
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    // Disconnecting drops every server-side room membership too.
    this.joinedDeliveryIds.clear();
    this.joinedOrderIds.clear();
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
   * Subscribes to a typed server event. Returns an unsubscribe function.
   *
   * A payload that fails schema parsing is routed to `onPayloadError`
   * (no-op by default) and never reaches `handler` -- see the class doc's
   * "Parse failures". A well-formed payload scoped to a delivery or order
   * that has not been joined (or was joined and then left) is silently
   * dropped -- see "Local room-membership filter".
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
        this.onPayloadError(event, err, raw);
        return;
      }
      if (!this.isJoinedScope(event, parsed)) {
        return;
      }
      handler(parsed);
    };
    const socket = this.socket as unknown as RawEventEmitter | null;
    socket?.on(event, listener);
    return () => {
      socket?.off(event, listener);
    };
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

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
 *    null, a string, an array) fails schema's `z.object()` check and throws
 *    out of the listener, immediately, in the caller's own call stack. A
 *    gateway contract change that alters the payload's basic shape surfaces
 *    as a legible thrown error, not an undefined field rendering blank on a
 *    tracking screen.
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
 * Net effect: gross contract breaks (wrong event shape entirely) are loud;
 * small field drift degrades the same way it already does everywhere else in
 * @kaya/core.
 */
export class SocketService {
  private socket: Socket | null = null;

  constructor(private readonly config: ApiConfig) {}

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
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
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
  }

  /**
   * No-op by design, not an oversight. events.gateway.ts has no
   * `@SubscribeMessage` handler for leaving a room -- a socket.io client
   * cannot unilaterally leave a room the server put it in, and this gateway
   * only tears delivery rooms down on disconnect. The brief specified
   * "delivery:leave"; there is no such event to emit to. Kept as a real
   * method (rather than dropped from the public API) so call sites can pair
   * it with joinDelivery unconditionally, and so a future gateway-side leave
   * handler can be wired in here without touching callers.
   */
  leaveDelivery(_deliveryId: string): void {
    // Intentionally does nothing on the wire -- see JSDoc above.
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

  /** Subscribes to a typed server event. Returns an unsubscribe function. */
  on<K extends keyof SocketEventMap>(
    event: K,
    handler: (payload: SocketEventMap[K]) => void,
  ): () => void {
    const listener = (raw: unknown) => {
      handler(PARSERS[event].parse(raw) as SocketEventMap[K]);
    };
    const socket = this.socket as unknown as RawEventEmitter | null;
    socket?.on(event, listener);
    return () => {
      socket?.off(event, listener);
    };
  }
}

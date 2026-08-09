import type { Message } from "../models/message";
import { queryKeys, type KayaQueryKey } from "../query/keys";
import type { SocketEventMap } from "./socket";

/**
 * The slice of a query cache this module needs, named as an interface so
 * `@kaya/core` stays free of `@tanstack/react-query` -- the same treatment
 * TokenStore, LocationProvider and PushProvider get for their platform SDKs.
 * Both apps satisfy it with a QueryClient in three lines; see
 * apps/*\/src/realtime/useSocketBridge.ts.
 */
export interface RealtimeCache {
  /**
   * Writes an entry directly, given its current value (`undefined` when the
   * entry does not exist yet). Never triggers a network request.
   */
  setQueryData<T>(key: KayaQueryKey, updater: (previous: T | undefined) => T): void;
  /**
   * Marks an entry (and everything prefixed by it) stale, so anything
   * currently mounted refetches it.
   */
  invalidateQueries(key: KayaQueryKey): void;
}

/**
 * How a live event reaches the screens: write it straight into the cache, or
 * ask for a refetch.
 *
 * The split is a bandwidth decision, not a stylistic one. The design's rule is
 * that an event carrying its whole payload is written with `setQueryData`,
 * while an event that only signals a change invalidates. `location:driver`
 * arrives every ~5 seconds for the whole length of a run: a refetch per tick
 * is unaffordable on West African mobile data, and it carries the entire new
 * position anyway, so it is a pure write. `offer:new` carries four fields of
 * an Offer -- no status, no created_at, no driver profile -- so writing it
 * would fabricate a half-built object the offer list would then render; it
 * invalidates instead, and the refetch is affordable because offers arrive a
 * handful of times per order, not every five seconds.
 *
 * Event by event:
 *
 * | event            | action                                    | why |
 * |------------------|-------------------------------------------|-----|
 * | location:driver  | write `driverLocation(livreurId)`          | complete payload, ~5s cadence |
 * | chat:message     | append to `messages(deliveryId)`          | the payload *is* a Message |
 * | delivery:status  | write `deliveryLiveStatus` + invalidate `delivery` | see below |
 * | offer:new        | invalidate `offers(orderId)`              | partial payload |
 * | offer:rejected   | invalidate `offers(orderId)`              | partial payload |
 * | offer:accepted   | invalidate `order(orderId)` + `deliveries()` | creates a delivery |
 *
 * `delivery:status` does both. The status string reaches the tracking screen
 * with no network round trip, which is what the user is waiting to see; the
 * `Delivery` object itself is invalidated because the transition also changes
 * fields the event does not carry (timestamps, the driver assignment). Status
 * transitions happen a handful of times per delivery, so the refetch is cheap
 * -- this is the opposite trade-off from location, for the opposite reason.
 *
 * `offer:accepted` invalidates the order rather than just its offers: accepting
 * an offer creates a Delivery and moves the order on, so the offer list, the
 * order and the deliveries list are all stale at once. `queryKeys.order()`
 * prefixes `queryKeys.offers()`, so one call covers the first two.
 */
export function applyRealtimeEvent<K extends keyof SocketEventMap>(
  cache: RealtimeCache,
  event: K,
  payload: SocketEventMap[K],
): void {
  switch (event) {
    case "location:driver": {
      const location = payload as SocketEventMap["location:driver"];
      cache.setQueryData(queryKeys.driverLocation(location.livreurId), () => location);
      return;
    }

    case "chat:message": {
      const message = payload as SocketEventMap["chat:message"];
      cache.setQueryData<Message[]>(queryKeys.messages(message.deliveryId), (previous) =>
        appendMessage(previous, message),
      );
      return;
    }

    case "delivery:status": {
      const status = payload as SocketEventMap["delivery:status"];
      cache.setQueryData(queryKeys.deliveryLiveStatus(status.deliveryId), () => status);
      cache.invalidateQueries(queryKeys.delivery(status.deliveryId));
      return;
    }

    case "offer:new":
    case "offer:rejected": {
      const offer = payload as SocketEventMap["offer:new"] | SocketEventMap["offer:rejected"];
      cache.invalidateQueries(queryKeys.offers(offer.orderId));
      return;
    }

    case "offer:accepted": {
      const accepted = payload as SocketEventMap["offer:accepted"];
      cache.invalidateQueries(queryKeys.order(accepted.orderId));
      cache.invalidateQueries(queryKeys.deliveries());
      return;
    }
  }
}

/**
 * Appends a live message to a cached thread, replacing any existing entry with
 * the same id.
 *
 * The replace is not paranoia. A chat screen loads its history over REST and
 * subscribes to the socket, and the gateway rebroadcasts a message to the
 * whole delivery room *including the sender* -- so the sender's own message
 * arrives back over the socket after the REST POST already returned it, and a
 * naive append renders it twice. Ordering is by `createdAt` rather than
 * arrival, because those two sources can interleave.
 */
function appendMessage(previous: Message[] | undefined, message: Message): Message[] {
  const existing = previous ?? [];
  const withoutDuplicate = existing.filter((m) => m.id !== message.id);
  return [...withoutDuplicate, message].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

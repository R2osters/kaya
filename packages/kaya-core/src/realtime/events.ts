import { z } from "zod";
import { dateLike, decimalLike, stringLike } from "../wire/coerce";
import { messageSchema } from "../models/message";

/**
 * Typed payloads for the NestJS realtime gateway. Verified directly against
 * `backend/src/realtime/events.gateway.ts`, `backend/src/realtime/realtime.service.ts`
 * and the callers that push events through it (`backend/src/offers/offers.service.ts`,
 * `backend/src/deliveries/deliveries.service.ts`) -- not transcribed from the design
 * doc or the legacy Dart client alone.
 *
 * The gateway is genuinely inconsistent, not just apparently so: offer events
 * (order room: offer:new, offer:accepted, offer:rejected) are camelCase, while
 * location, delivery, and chat events (delivery room: location:driver,
 * delivery:status, chat:message) are snake_case for their id-shaped fields.
 * That split is preserved here deliberately -- do not normalise it away.
 *
 * `status` on delivery:status is deliberately a free string, not the
 * DELIVERY_STATUSES wire enum (see ../wire/enums.ts). `DeliveriesService.transition()`
 * calls `emitDeliveryStatus(deliveryId, orderStatus)` with OrderStatus values
 * (picked_up, driver_en_route, in_transit, delivered) as an order-lifecycle
 * transition also advances its delivery, not only with DeliveryStatus values
 * (in_progress, completed, cancelled, disputed). Coercing through the
 * delivery enum would silently rewrite a live "in_transit" event to the
 * enum's "in_progress" fallback and freeze the tracking screen's status text.
 */

export const SOCKET_EVENTS = {
  /** server -> client (order room, emitted by RealtimeService.emitToOrder from offers.service.ts) */
  offerNew: "offer:new",
  offerAccepted: "offer:accepted",
  offerRejected: "offer:rejected",
  /** server -> client (delivery room, emitted by RealtimeService.emitToDelivery) */
  driverLocation: "location:driver",
  deliveryStatus: "delivery:status",
  chatMessage: "chat:message",
  /** client -> server */
  locationUpdate: "location:update",
  /**
   * The gateway's only handler that unlocks a delivery room -- decorated
   * `@SubscribeMessage('chat:join')`, payload `{ delivery_id }` -- joining it
   * is what makes location:driver/chat:message/delivery:status arrive for
   * that delivery. There is no separate "delivery:join" event on the
   * gateway; that name does not exist on the wire.
   */
  joinDelivery: "chat:join",
} as const;

export const offerNewEventSchema = z.object({
  offerId: stringLike(),
  orderId: stringLike(),
  livreurId: stringLike(),
  proposedPrice: decimalLike(),
});
export type OfferNewEvent = z.infer<typeof offerNewEventSchema>;

export const offerAcceptedEventSchema = z.object({
  offerId: stringLike(),
  orderId: stringLike(),
  deliveryId: stringLike(),
  livreurId: stringLike(),
});
export type OfferAcceptedEvent = z.infer<typeof offerAcceptedEventSchema>;

/**
 * server -> 'offer:rejected' { offerId, orderId } (order room). Not in the
 * original brief's event table at all -- found while reading offers.service.ts's
 * `rejectOffer()`, which emits it through the same `emitToOrder` path as
 * offer:new/offer:accepted. Omitting it would have been exactly the kind of
 * silent gap this task is meant to catch: a client watching an order would
 * simply never learn a driver's offer was declined.
 */
export const offerRejectedEventSchema = z.object({
  offerId: stringLike(),
  orderId: stringLike(),
});
export type OfferRejectedEvent = z.infer<typeof offerRejectedEventSchema>;

export const driverLocationEventSchema = z
  .object({
    livreur_id: z.unknown(),
    lat: decimalLike(),
    lng: decimalLike(),
    timestamp: dateLike(),
  })
  .transform((e) => ({
    livreurId: stringLike().parse(e.livreur_id),
    lat: e.lat,
    lng: e.lng,
    timestamp: e.timestamp,
  }));
export type DriverLocationEvent = z.infer<typeof driverLocationEventSchema>;

export const deliveryStatusEventSchema = z
  .object({
    delivery_id: z.unknown(),
    status: stringLike(),
    timestamp: dateLike(),
  })
  .transform((e) => ({
    deliveryId: stringLike().parse(e.delivery_id),
    status: e.status,
    timestamp: e.timestamp,
  }));
export type DeliveryStatusEvent = z.infer<typeof deliveryStatusEventSchema>;

export const chatMessageEventSchema = messageSchema;
export type ChatMessageEvent = z.infer<typeof chatMessageEventSchema>;

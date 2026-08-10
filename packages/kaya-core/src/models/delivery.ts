import { z } from "zod";
import {
  dateLike,
  dateLikeOrNull,
  decimalLike,
  decimalLikeOrNull,
  isPlainObject,
  stringLike,
  stringLikeOrNull,
} from "../wire/coerce";
import { clientPaymentStatus, deliveryStatus } from "../wire/enums";
import { orderSchema } from "./order";
import { userSchema } from "./user";

/**
 * An accepted order in execution. Mirrors backend `deliveries`, with optional
 * embedded `order` and `livreur` relations.
 */
export const deliverySchema = z
  .object({
    id: stringLike(),
    orderId: stringLike(),
    livreurId: stringLike(),
    status: deliveryStatus,
    clientPaymentStatus,
    pickupPhoto: stringLikeOrNull(),
    deliveryPhoto: stringLikeOrNull(),
    startTime: dateLikeOrNull(),
    pickupTime: dateLikeOrNull(),
    deliveryTime: dateLikeOrNull(),
    deliveryConfirmedAt: dateLikeOrNull(),
    distanceKm: decimalLikeOrNull(),
    basePrice: decimalLikeOrNull(),
    commissionRate: decimalLikeOrNull(),
    commissionAmount: decimalLikeOrNull(),
    litigationFee: decimalLike(1),
    netEarnings: decimalLikeOrNull(),
    createdAt: dateLike(),
    order: z.unknown(),
    livreur: z.unknown(),
  })
  .transform((d) => ({
    id: d.id,
    orderId: d.orderId,
    livreurId: d.livreurId,
    status: d.status,
    clientPaymentStatus: d.clientPaymentStatus,
    pickupPhoto: d.pickupPhoto,
    deliveryPhoto: d.deliveryPhoto,
    startTime: d.startTime,
    pickupTime: d.pickupTime,
    deliveryTime: d.deliveryTime,
    deliveryConfirmedAt: d.deliveryConfirmedAt,
    distanceKm: d.distanceKm,
    basePrice: d.basePrice,
    commissionRate: d.commissionRate,
    commissionAmount: d.commissionAmount,
    litigationFee: d.litigationFee,
    netEarnings: d.netEarnings,
    createdAt: d.createdAt,
    order: isPlainObject(d.order) ? orderSchema.parse(d.order) : null,
    driver: isPlainObject(d.livreur) ? userSchema.parse(d.livreur) : null,
  }));

export type Delivery = z.infer<typeof deliverySchema>;

/**
 * Maps the delivery lifecycle onto the 4-step tracking timeline.
 * 0 = en route, 1 = picked up, 2 = in transit, 3 = delivered.
 */
export function timelineStep(d: Delivery): 0 | 1 | 2 | 3 {
  if (d.deliveryTime !== null || d.status === "completed") return 3;
  if (d.pickupTime !== null) {
    return d.order?.status === "in_transit" ? 2 : 1;
  }
  return 0;
}

/**
 * The same 4-step position, derived from a live `delivery:status` event
 * instead of from the cached delivery.
 *
 * The event reaches a tracking screen with no round trip, while the `Delivery`
 * behind `timelineStep` only refreshes once the invalidation it triggers has
 * come back. Reading the event first is the difference between a timeline that
 * advances when the driver acts and one that advances a second later.
 *
 * The status string is deliberately not the DeliveryStatus enum:
 * `DeliveriesService.transition()` emits OrderStatus values (picked_up,
 * driver_en_route, in_transit, delivered) down this channel as well, because
 * an order-lifecycle transition also advances its delivery. Both vocabularies
 * are mapped here.
 *
 * Returns null for a status that says nothing about position -- `cancelled`,
 * `disputed`, or anything unrecognised -- and the caller falls back to
 * `timelineStep`. Guessing a step from a cancellation would move the timeline
 * forward on an event that means the opposite.
 */
export function liveTimelineStep(status: string): 0 | 1 | 2 | 3 | null {
  switch (status) {
    case "driver_en_route":
    case "accepted":
      return 0;
    case "picked_up":
      return 1;
    case "in_transit":
    case "in_progress":
      return 2;
    case "delivered":
    case "completed":
      return 3;
    default:
      return null;
  }
}

import { z } from "zod";
import {
  dateLike,
  dateLikeOrNull,
  decimalLike,
  decimalLikeOrNull,
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
    order:
      d.order !== null && typeof d.order === "object"
        ? orderSchema.parse(d.order)
        : null,
    driver:
      d.livreur !== null && typeof d.livreur === "object"
        ? userSchema.parse(d.livreur)
        : null,
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

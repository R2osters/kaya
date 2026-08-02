import { z } from "zod";
import { dateLike, dateLikeOrNull, decimalLike, isPlainObject, stringLike } from "../wire/coerce";
import { offerStatus } from "../wire/enums";
import { userSchema } from "./user";

/**
 * A driver's price bid on an order. Mirrors backend `offers`; the bidding driver
 * is embedded under `livreur` when the API includes the relation.
 */
export const offerSchema = z
  .object({
    id: stringLike(),
    orderId: stringLike(),
    livreurId: stringLike(),
    proposedPrice: decimalLike(),
    minPrice: decimalLike(),
    status: offerStatus,
    createdAt: dateLike(),
    expiresAt: dateLikeOrNull(),
    livreur: z.unknown(),
  })
  .transform((o) => ({
    id: o.id,
    orderId: o.orderId,
    livreurId: o.livreurId,
    proposedPrice: o.proposedPrice,
    minPrice: o.minPrice,
    status: o.status,
    createdAt: o.createdAt,
    expiresAt: o.expiresAt,
    driver: isPlainObject(o.livreur) ? userSchema.parse(o.livreur) : null,
  }));

export type Offer = z.infer<typeof offerSchema>;

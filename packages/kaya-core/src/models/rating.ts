import { z } from "zod";
import { dateLike, decimalLike, intLike, stringLike, stringLikeOrNull } from "../wire/coerce";

/** A 1–5 rating, unique per (delivery, author). Mirrors backend `ratings`. */
export const ratingSchema = z.object({
  id: stringLike(),
  deliveryId: stringLike(),
  fromUserId: stringLike(),
  toUserId: stringLike(),
  score: intLike(0),
  comment: stringLikeOrNull(),
  createdAt: dateLike(),
});

export type Rating = z.infer<typeof ratingSchema>;

export const ratingSummarySchema = z.object({
  average: decimalLike(0),
  count: intLike(0),
  ratings: z
    .unknown()
    .transform((v) => (Array.isArray(v) ? v.map((r) => ratingSchema.parse(r)) : [])),
});

export type RatingSummary = z.infer<typeof ratingSummarySchema>;

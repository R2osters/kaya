import { z } from "zod";
import {
  dateLike,
  decimalLike,
  intLike,
  isPlainObject,
  stringLike,
  stringLikeOrNull,
} from "../wire/coerce";

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
  // Non-object entries are dropped rather than parsed, mirroring Dart's
  // `whereType<Map>()`. Feeding one to `ratingSchema.parse` would throw out of
  // this transform and reject the whole summary — this package never rejects.
  ratings: z
    .unknown()
    .transform((v) =>
      Array.isArray(v)
        ? v.filter(isPlainObject).map((r) => ratingSchema.parse(r))
        : [],
    ),
});

export type RatingSummary = z.infer<typeof ratingSummarySchema>;

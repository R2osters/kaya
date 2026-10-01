import { z } from "zod";
import {
  dateLike,
  dateLikeOrNull,
  decimalLike,
  decimalLikeOrNull,
  stringLike,
  stringLikeOrNull,
} from "../wire/coerce";
import { isPlainObject } from "../wire/coerce";
import { orderStatus } from "../wire/enums";
import type { GeoPoint } from "./geo";
import { participantSchema } from "./participant";

/**
 * A delivery order created by a client. Mirrors backend `orders`, whose
 * coordinates arrive as four flat columns and are folded into geo points here.
 */
export const orderSchema = z
  .object({
    id: stringLike(),
    clientId: stringLike(),
    pickupAddress: stringLike(),
    pickupLat: decimalLike(),
    pickupLng: decimalLike(),
    deliveryAddress: stringLike(),
    deliveryLat: decimalLike(),
    deliveryLng: decimalLike(),
    status: orderStatus,
    description: stringLikeOrNull(),
    packagePhoto: stringLikeOrNull(),
    weightKg: decimalLikeOrNull(),
    dimensions: stringLikeOrNull(),
    scheduledTime: dateLikeOrNull(),
    publishedAt: dateLikeOrNull(),
    minPriceSuggested: decimalLikeOrNull(),
    distanceKm: decimalLikeOrNull(),
    acceptedOfferId: stringLikeOrNull(),
    createdAt: dateLike(),
    /**
     * Present on participant-facing delivery reads (`GET /deliveries`,
     * `GET /deliveries/:id`), absent everywhere else -- an order the driver
     * is merely bidding on does not name its client.
     */
    client: z.unknown(),
  })
  .transform((o) => {
    const pickup: GeoPoint = { lat: o.pickupLat, lng: o.pickupLng };
    const dropoff: GeoPoint = { lat: o.deliveryLat, lng: o.deliveryLng };
    return {
      id: o.id,
      clientId: o.clientId,
      pickupAddress: o.pickupAddress,
      pickup,
      deliveryAddress: o.deliveryAddress,
      dropoff,
      status: o.status,
      description: o.description,
      packagePhoto: o.packagePhoto,
      weightKg: o.weightKg,
      dimensions: o.dimensions,
      scheduledTime: o.scheduledTime,
      publishedAt: o.publishedAt,
      minPriceSuggested: o.minPriceSuggested,
      distanceKm: o.distanceKm,
      acceptedOfferId: o.acceptedOfferId,
      createdAt: o.createdAt,
      client: isPlainObject(o.client) ? participantSchema.parse(o.client) : null,
    };
  });

export type Order = z.infer<typeof orderSchema>;

export const isScheduled = (o: Order): boolean => o.scheduledTime !== null;

export const isLive = (o: Order): boolean =>
  o.status === "published" || o.status === "offers_received";

import { z } from "zod";
import { decimalLike } from "../wire/coerce";

export const geoPointSchema = z.object({
  lat: decimalLike(),
  lng: decimalLike(),
});

export type GeoPoint = z.infer<typeof geoPointSchema>;

export const geoPointsEqual = (a: GeoPoint, b: GeoPoint): boolean =>
  a.lat === b.lat && a.lng === b.lng;

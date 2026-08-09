import { z } from "zod";
import { decimalLike, stringLike, stringLikeOrNull } from "../wire/coerce";
import type { GeoPoint } from "./geo";

/**
 * One row in the address type-ahead, as returned by `GET /geocoding/search`
 * (backend/src/geocoding/geocoding.controller.ts).
 *
 * `label` is what the list renders: the place plus enough context to tell two
 * identically-named places apart. Whatever the user picks becomes a pickup or
 * drop-off point, and the price is `distance_km × price_per_km`, so the
 * coordinates below are a money field in everything but name.
 */
export const addressSuggestionSchema = z.object({
  label: stringLike(),
  name: stringLike(),
  city: stringLikeOrNull(),
  countryCode: stringLikeOrNull(),
  lat: decimalLike(),
  lng: decimalLike(),
});

export type AddressSuggestion = z.infer<typeof addressSuggestionSchema>;

/**
 * The suggestion as the rest of the platform wants it: a plain GeoPoint.
 * Every distance, quote and map marker takes one of these, so a screen should
 * convert at the point of selection rather than passing the whole suggestion
 * down and reading `.lat`/`.lng` off it in five places.
 */
export function suggestionPoint(suggestion: AddressSuggestion): GeoPoint {
  return { lat: suggestion.lat, lng: suggestion.lng };
}

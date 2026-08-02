import { z } from "zod";
import { parseCountryCode, parseCurrency } from "../money/currency";
import { decimalLike, intLikeOrNull, stringLike, stringLikeOrNull } from "../wire/coerce";

/** Result of GET /calculate-price (distance plus minimum suggested price). */
export const priceQuoteSchema = z.object({
  countryCode: z.unknown().transform(parseCountryCode),
  distanceKm: decimalLike(0),
  minPrice: decimalLike(0),
  currency: z.unknown().transform(parseCurrency),
  currencySymbol: stringLike(),
  pricePerKm: decimalLike(0),
  basePickupFee: decimalLike(0),
  durationMin: intLikeOrNull(),
  source: stringLikeOrNull(),
});

export type PriceQuote = z.infer<typeof priceQuoteSchema>;

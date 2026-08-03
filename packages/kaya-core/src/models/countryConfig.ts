import { z } from "zod";
import { parseCountryCode, parseCurrency } from "../money/currency";
import { decimalLike, intLike, stringLike } from "../wire/coerce";

const stringList = () =>
  z.unknown().transform((v) => (Array.isArray(v) ? v.map(String) : []));

/**
 * Per-country pricing and commission configuration (backend `country_configs`).
 * The four tier columns are collapsed into an ordered array so callers never
 * index a column name.
 */
export const countryConfigSchema = z
  .object({
    countryCode: z.unknown().transform(parseCountryCode),
    countryName: stringLike(),
    currencyCode: z.unknown(),
    currencySymbol: stringLike(),
    pricePerKm: decimalLike(0),
    basePickupFee: decimalLike(0),
    commissionTier1: decimalLike(0.2),
    commissionTier2: decimalLike(0.15),
    commissionTier3: decimalLike(0.12),
    commissionTier4: decimalLike(0.09),
    litigationFee: decimalLike(1),
    searchRadiusKm: intLike(5),
    withdrawalMethods: stringList(),
    momoProviders: stringList(),
  })
  .transform((c) => ({
    countryCode: c.countryCode,
    countryName: c.countryName,
    currency: parseCurrency(c.currencyCode),
    currencySymbol: c.currencySymbol,
    pricePerKm: c.pricePerKm,
    basePickupFee: c.basePickupFee,
    /** [tier1, tier2, tier3, tier4] as fractions. */
    commissionTiers: [
      c.commissionTier1,
      c.commissionTier2,
      c.commissionTier3,
      c.commissionTier4,
    ] as const,
    litigationFee: c.litigationFee,
    searchRadiusKm: c.searchRadiusKm,
    withdrawalMethods: c.withdrawalMethods,
    momoProviders: c.momoProviders,
  }));

export type CountryConfig = z.infer<typeof countryConfigSchema>;

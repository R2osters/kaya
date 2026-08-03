import { currencyDecimals, type Currency } from "./currency";
import { roundMoney } from "./round";

/** [tier1, tier2, tier3, tier4] as fractions -- see ../models/countryConfig.ts. */
export type CommissionTiers = readonly [number, number, number, number];

/**
 * Fallback tiers matching the backend's `country_configs` column defaults
 * (`commissionTier1..4` in backend/prisma/schema.prisma). Only meant for
 * callers that genuinely have no country config yet (e.g. an offline
 * estimate before the app has fetched one) -- once a country config is
 * available, its `commissionTiers` must be passed instead, because a
 * country whose config differs from these defaults (the entire reason the
 * rates are config columns and not constants) would otherwise show a
 * driver an earnings preview that disagrees with what the ledger actually
 * charges.
 */
export const DEFAULT_COMMISSION_TIERS: CommissionTiers = [0.2, 0.15, 0.12, 0.09];

/**
 * Degressive commission. The tier is decided by the *number of the delivery
 * being made today* (1-based), not by how many are already done — decisions log
 * 2026-07-10. The 7th delivery of the day is charged tier 2. Counters reset at
 * midnight in the country's timezone, which the backend owns.
 *
 * The tier *thresholds* (1-6, 7-10, 11-14, 15+) are policy and stay fixed
 * here; the *rates* for each tier are per-country config
 * (`backend/src/commission/commission.service.ts` reads
 * `commissionTier1..4` off `CountryConfig`) and must come from the caller --
 * see `commissionPreview` below.
 */
export function commissionRateForDeliveryNumber(
  deliveryNumber: number,
  tiers: CommissionTiers,
): number {
  if (deliveryNumber >= 15) return tiers[3];
  if (deliveryNumber >= 11) return tiers[2];
  if (deliveryNumber >= 7) return tiers[1];
  return tiers[0];
}

export interface CommissionPreview {
  readonly grossPrice: number;
  readonly completedToday: number;
  readonly litigationFee: number;
  readonly deliveryNumber: number;
  readonly rate: number;
  readonly ratePercent: number;
  readonly commission: number;
  readonly net: number;
}

/**
 * Net earnings preview for a driver's proposed price. The delivery about to be
 * made is number `completedToday + 1`. `litigationFee` and `commissionTiers`
 * both come from the country's config (`CountryConfig.commissionTiers`,
 * 1 GHS/100 XOF litigation fee) and are never constants here -- the moment
 * Togo or Benin get different tiers than Ghana, hardcoding them would make
 * this preview disagree with the ledger.
 *
 * `commission` and `net` are rounded to `currency`'s own decimal count
 * (`currencyDecimals`), not always to two decimals. Rounding both to the
 * same granularity the UI will actually display (0 for XOF, 2 for GHS/NGN)
 * is what makes `commission + net + litigationFee` reconcile to
 * `grossPrice` on screen -- rounding to two decimals and only truncating at
 * display time lets a XOF commission and net that each sit at `x.5`
 * independently round up, silently losing a currency unit off the total.
 */
export function commissionPreview(input: {
  grossPrice: number;
  completedToday: number;
  litigationFee: number;
  commissionTiers: CommissionTiers;
  currency: Currency;
}): CommissionPreview {
  const { grossPrice, completedToday, litigationFee, commissionTiers, currency } = input;
  const decimals = currencyDecimals(currency);
  const deliveryNumber = completedToday + 1;
  const rate = commissionRateForDeliveryNumber(deliveryNumber, commissionTiers);
  const commission = roundMoney(grossPrice * rate, decimals);
  return {
    grossPrice,
    completedToday,
    litigationFee,
    deliveryNumber,
    rate,
    ratePercent: Math.round(rate * 100),
    commission,
    net: roundMoney(grossPrice - commission - litigationFee, decimals),
  };
}

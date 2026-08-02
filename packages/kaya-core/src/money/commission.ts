import { roundMoney } from "./round";

/**
 * Degressive commission. The tier is decided by the *number of the delivery
 * being made today* (1-based), not by how many are already done — decisions log
 * 2026-07-10. The 7th delivery of the day is charged 15%. Counters reset at
 * midnight in the country's timezone, which the backend owns.
 */
export function commissionRateForDeliveryNumber(deliveryNumber: number): number {
  if (deliveryNumber >= 15) return 0.09;
  if (deliveryNumber >= 11) return 0.12;
  if (deliveryNumber >= 7) return 0.15;
  return 0.2;
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
 * made is number `completedToday + 1`. `litigationFee` comes from the country's
 * config (1 GHS in Ghana, 100 XOF in Togo/Benin) and is never a constant here.
 */
export function commissionPreview(input: {
  grossPrice: number;
  completedToday: number;
  litigationFee: number;
}): CommissionPreview {
  const { grossPrice, completedToday, litigationFee } = input;
  const deliveryNumber = completedToday + 1;
  const rate = commissionRateForDeliveryNumber(deliveryNumber);
  const commission = roundMoney(grossPrice * rate);
  return {
    grossPrice,
    completedToday,
    litigationFee,
    deliveryNumber,
    rate,
    ratePercent: Math.round(rate * 100),
    commission,
    net: roundMoney(grossPrice - commission - litigationFee),
  };
}

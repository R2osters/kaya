import {
  DEFAULT_COMMISSION_TIERS,
  commissionPreview,
  commissionRateForDeliveryNumber,
} from "./commission";

describe("commissionRateForDeliveryNumber", () => {
  it("charges tier 1 (20%) for the first six deliveries of the day", () => {
    expect(commissionRateForDeliveryNumber(1, DEFAULT_COMMISSION_TIERS)).toBe(0.2);
    expect(commissionRateForDeliveryNumber(6, DEFAULT_COMMISSION_TIERS)).toBe(0.2);
  });

  it("charges tier 2 (15%) from the seventh delivery", () => {
    // Decisions log 2026-07-10: the tier follows the number of the delivery
    // being made, so the 7th of the day is already at tier 2.
    expect(commissionRateForDeliveryNumber(7, DEFAULT_COMMISSION_TIERS)).toBe(0.15);
    expect(commissionRateForDeliveryNumber(10, DEFAULT_COMMISSION_TIERS)).toBe(0.15);
  });

  it("charges tier 3 (12%) from the eleventh and tier 4 (9%) from the fifteenth", () => {
    expect(commissionRateForDeliveryNumber(11, DEFAULT_COMMISSION_TIERS)).toBe(0.12);
    expect(commissionRateForDeliveryNumber(14, DEFAULT_COMMISSION_TIERS)).toBe(0.12);
    expect(commissionRateForDeliveryNumber(15, DEFAULT_COMMISSION_TIERS)).toBe(0.09);
    expect(commissionRateForDeliveryNumber(99, DEFAULT_COMMISSION_TIERS)).toBe(0.09);
  });

  it("reads the rate from whatever tiers a country config supplies, not a hardcoded table", () => {
    // A country with different negotiated tiers than Ghana's defaults must
    // get different rates back for the same delivery numbers.
    const togoTiers = [0.25, 0.2, 0.18, 0.15] as const;
    expect(commissionRateForDeliveryNumber(1, togoTiers)).toBe(0.25);
    expect(commissionRateForDeliveryNumber(7, togoTiers)).toBe(0.2);
    expect(commissionRateForDeliveryNumber(11, togoTiers)).toBe(0.18);
    expect(commissionRateForDeliveryNumber(15, togoTiers)).toBe(0.15);
  });
});

describe("commissionPreview", () => {
  it("bills the next delivery, not the last completed one", () => {
    const p = commissionPreview({
      grossPrice: 28,
      completedToday: 6,
      litigationFee: 1,
      commissionTiers: DEFAULT_COMMISSION_TIERS,
      currency: "GHS",
    });
    expect(p.deliveryNumber).toBe(7);
    expect(p.rate).toBe(0.15);
    expect(p.ratePercent).toBe(15);
    expect(p.commission).toBe(4.2);
    expect(p.net).toBe(22.8);
  });

  it("starts a fresh day at tier 1", () => {
    const p = commissionPreview({
      grossPrice: 50,
      completedToday: 0,
      litigationFee: 1,
      commissionTiers: DEFAULT_COMMISSION_TIERS,
      currency: "GHS",
    });
    expect(p.deliveryNumber).toBe(1);
    expect(p.rate).toBe(0.2);
    expect(p.commission).toBe(10);
    expect(p.net).toBe(39);
  });

  it("a country with different commission tiers produces different figures for the same inputs", () => {
    const ghana = commissionPreview({
      grossPrice: 28,
      completedToday: 6,
      litigationFee: 1,
      commissionTiers: DEFAULT_COMMISSION_TIERS,
      currency: "GHS",
    });
    const togo = commissionPreview({
      grossPrice: 28,
      completedToday: 6,
      litigationFee: 1,
      commissionTiers: [0.25, 0.2, 0.18, 0.15],
      currency: "GHS",
    });
    expect(ghana.rate).toBe(0.15);
    expect(togo.rate).toBe(0.2);
    expect(ghana.commission).not.toBe(togo.commission);
    expect(ghana.net).not.toBe(togo.net);
  });

  it("rounds commission and net to XOF's zero decimals so gross = commission + net + litigationFee on screen", () => {
    // Regression for the reconciliation bug: rounding to two decimals and
    // only truncating at display time made 1250 - 188 - 963 = 99, not the
    // 100 XOF litigation fee actually charged.
    const p = commissionPreview({
      grossPrice: 1250,
      completedToday: 6,
      litigationFee: 100,
      commissionTiers: DEFAULT_COMMISSION_TIERS,
      currency: "XOF",
    });
    expect(p.rate).toBe(0.15);
    expect(p.commission).toBe(188);
    expect(p.net).toBe(962);
    expect(p.commission + p.net + p.litigationFee).toBe(p.grossPrice);
  });

  it("applies the XOF litigation fee of 100 at tier 4", () => {
    const p = commissionPreview({
      grossPrice: 3000,
      completedToday: 14,
      litigationFee: 100,
      commissionTiers: DEFAULT_COMMISSION_TIERS,
      currency: "XOF",
    });
    expect(p.rate).toBe(0.09);
    expect(p.commission).toBe(270);
    expect(p.net).toBe(2630);
  });
});

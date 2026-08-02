import { commissionPreview, commissionRateForDeliveryNumber } from "./commission";

describe("commissionRateForDeliveryNumber", () => {
  it("charges 20% for the first six deliveries of the day", () => {
    expect(commissionRateForDeliveryNumber(1)).toBe(0.2);
    expect(commissionRateForDeliveryNumber(6)).toBe(0.2);
  });

  it("charges 15% from the seventh delivery", () => {
    // Decisions log 2026-07-10: the tier follows the number of the delivery
    // being made, so the 7th of the day is already at 15%.
    expect(commissionRateForDeliveryNumber(7)).toBe(0.15);
    expect(commissionRateForDeliveryNumber(10)).toBe(0.15);
  });

  it("charges 12% from the eleventh and 9% from the fifteenth", () => {
    expect(commissionRateForDeliveryNumber(11)).toBe(0.12);
    expect(commissionRateForDeliveryNumber(14)).toBe(0.12);
    expect(commissionRateForDeliveryNumber(15)).toBe(0.09);
    expect(commissionRateForDeliveryNumber(99)).toBe(0.09);
  });
});

describe("commissionPreview", () => {
  it("bills the next delivery, not the last completed one", () => {
    const p = commissionPreview({
      grossPrice: 28,
      completedToday: 6,
      litigationFee: 1,
    });
    expect(p.deliveryNumber).toBe(7);
    expect(p.rate).toBe(0.15);
    expect(p.ratePercent).toBe(15);
    expect(p.commission).toBe(4.2);
    expect(p.net).toBe(22.8);
  });

  it("starts a fresh day at 20%", () => {
    const p = commissionPreview({
      grossPrice: 50,
      completedToday: 0,
      litigationFee: 1,
    });
    expect(p.deliveryNumber).toBe(1);
    expect(p.rate).toBe(0.2);
    expect(p.commission).toBe(10);
    expect(p.net).toBe(39);
  });

  it("applies the XOF litigation fee of 100", () => {
    const p = commissionPreview({
      grossPrice: 3000,
      completedToday: 14,
      litigationFee: 100,
    });
    expect(p.rate).toBe(0.09);
    expect(p.commission).toBe(270);
    expect(p.net).toBe(2630);
  });
});

import { countryConfigSchema } from "./countryConfig";
import { priceQuoteSchema } from "./priceQuote";

describe("countryConfigSchema", () => {
  it("collapses the four tier columns into an ordered array", () => {
    const c = countryConfigSchema.parse({
      countryCode: "TGO",
      countryName: "Togo",
      currencyCode: "XOF",
      currencySymbol: "XOF",
      pricePerKm: "150",
      basePickupFee: "300",
      commissionTier1: "0.25",
      commissionTier2: "0.18",
      commissionTier3: "0.14",
      commissionTier4: "0.10",
      litigationFee: "100",
      searchRadiusKm: 5,
      withdrawalMethods: ["momo", "bank_transfer"],
      momoProviders: ["Moov", "Togocom"],
    });
    expect(c.commissionTiers).toEqual([0.25, 0.18, 0.14, 0.1]);
    expect(c.currency).toBe("XOF");
    expect(c.pricePerKm).toBe(150);
    expect(c.litigationFee).toBe(100);
    expect(c.momoProviders).toEqual(["Moov", "Togocom"]);
  });

  it("uses documented defaults when tiers and lists are missing", () => {
    const c = countryConfigSchema.parse({ countryCode: "GHA" });
    expect(c.commissionTiers).toEqual([0.2, 0.15, 0.12, 0.09]);
    expect(c.litigationFee).toBe(1);
    expect(c.searchRadiusKm).toBe(5);
    expect(c.withdrawalMethods).toEqual([]);
  });
});

describe("priceQuoteSchema", () => {
  it("parses the calculate-price response", () => {
    const q = priceQuoteSchema.parse({
      countryCode: "GHA",
      distanceKm: "6.2",
      minPrice: "24.00",
      currency: "GHS",
      currencySymbol: "GHS",
      pricePerKm: "1",
      basePickupFee: "2",
      durationMin: "18",
      source: "haversine",
    });
    expect(q.distanceKm).toBe(6.2);
    expect(q.minPrice).toBe(24);
    expect(q.durationMin).toBe(18);
    expect(q.source).toBe("haversine");
  });
});

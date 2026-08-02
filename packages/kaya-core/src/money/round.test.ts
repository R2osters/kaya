import { roundMoney } from "./round";

describe("roundMoney", () => {
  it("keeps two decimals", () => {
    expect(roundMoney(12.345)).toBe(12.35);
    expect(roundMoney(12.344)).toBe(12.34);
  });

  it("drops binary float noise", () => {
    // 28 * 0.15 is 4.199999999999999 in IEEE-754.
    expect(roundMoney(28 * 0.15)).toBe(4.2);
  });

  it("returns whole numbers unchanged", () => {
    expect(roundMoney(30)).toBe(30);
  });

  it("handles negatives symmetrically", () => {
    expect(roundMoney(-12.345)).toBe(-12.35);
  });
});

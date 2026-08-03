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

  it("rounds half up on values that sit just below the binary .5 boundary", () => {
    // (1.005).toFixed(2) === "1.00" and (0.145).toFixed(2) === "0.14" under
    // plain IEEE-754 rounding; the backend's Prisma.Decimal ROUND_HALF_UP
    // rounds both up, so roundMoney must too.
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(0.145)).toBe(0.15);
  });

  it("rounds half away from zero for negative boundary values", () => {
    // Proves this is round-half-away-from-zero, not round-half-toward
    // positive-infinity (which is what Math.round would give, since
    // Math.round(-0.5) === -0).
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(-0.145)).toBe(-0.15);
  });

  it("leaves a value already at two decimals unchanged", () => {
    expect(roundMoney(12.3)).toBe(12.3);
  });

  it("rounds large XOF-scale amounts correctly", () => {
    expect(roundMoney(1234567.891)).toBe(1234567.89);
  });

  it("passes non-finite input through unchanged", () => {
    expect(roundMoney(NaN)).toBeNaN();
    expect(roundMoney(Infinity)).toBe(Infinity);
    expect(roundMoney(-Infinity)).toBe(-Infinity);
  });

  it("normalises negative-zero results to plain zero", () => {
    // Without the fix, sign (-1) * roundedUnits (0) is -0, which formatMoney
    // would render as "-0.00 GHS".
    const result = roundMoney(-0.001);
    expect(result).toBe(0);
    expect(Object.is(result, -0)).toBe(false);
  });

  it("rounds to zero decimals for zero-decimal currencies like XOF", () => {
    expect(roundMoney(187.5, 0)).toBe(188);
    expect(roundMoney(962.5, 0)).toBe(963);
    expect(roundMoney(-187.5, 0)).toBe(-188);
    expect(roundMoney(1250, 0)).toBe(1250);
  });
});

/**
 * Rounds to two decimals, half away from zero, matching the backend's
 * `Prisma.Decimal` `ROUND_HALF_UP` mode (decimal.js semantics: 0.5 rounds
 * away from zero in both directions), so client-side earnings previews
 * agree with the ledger to the cent.
 *
 * `Number(value.toFixed(2))` was used previously, but `toFixed` rounds
 * based on the raw IEEE-754 binary representation of `value`, which for
 * some inputs sits just below the intended `.5` boundary (`1.005` is
 * actually stored as ~`1.00499999999999989`), so `(1.005).toFixed(2)`
 * yields `"1.00"` instead of `"1.01"`. `Math.round` has the same binary
 * drift problem, and additionally rounds half *toward positive infinity*
 * rather than away from zero (`Math.round(-0.5) === -0`), which would
 * disagree with the backend's ROUND_HALF_UP on negative amounts.
 *
 * To avoid pulling in `decimal.js` (an explicit project constraint), we
 * neutralise the binary drift by scaling to cents and re-presenting the
 * scaled value through `toPrecision`, which snaps a value that is
 * mathematically exactly `x.5` (but stored as `x.49999999999999994` or
 * similar) back to `x.5` before rounding half up manually, then reapply
 * the sign and rescale.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  const sign = value < 0 ? -1 : 1;
  const scaledCents = Math.abs(value) * 100;

  // 15 significant digits is within the ~15-17 digit precision a double
  // can reliably round-trip, so this removes float noise without losing
  // real precision for any realistic money amount (XOF prices reach the
  // thousands/millions, i.e. well under 15 significant digits).
  const normalizedCents = Number(scaledCents.toPrecision(15));

  // Round half away from zero (we already stripped the sign above).
  const roundedCents = Math.floor(normalizedCents + 0.5);

  return (sign * roundedCents) / 100;
}

import { Prisma } from '@prisma/client';

/**
 * How many decimal places a currency actually has.
 *
 * XOF (Togo, Benin) is a zero-decimal currency: there is no coin below one
 * franc, no price is ever quoted with a fractional part, and no payment
 * gateway in the CFA zone accepts one. GHS (Ghana) has pesewas, so two.
 *
 * This mirrors `currencyDecimals` in packages/kaya-core/src/money/currency.ts.
 * The two must agree: the apps render an earnings preview from the client-side
 * rule and the ledger is written from this one, and where they disagree the
 * driver sees a number that is not the number they are paid.
 *
 * NGN is display-only for now (v2 parking lot) but is listed so an amount in
 * it rounds sensibly rather than falling through a default nobody chose.
 */
const CURRENCY_DECIMALS: Record<string, number> = {
  XOF: 0,
  GHS: 2,
  NGN: 2,
};

/** Two decimals for an unknown currency: the safer wrong answer of the two. */
const DEFAULT_DECIMALS = 2;

export function currencyDecimals(currencyCode: string): number {
  return CURRENCY_DECIMALS[currencyCode] ?? DEFAULT_DECIMALS;
}

/**
 * Rounds an amount to its currency's smallest real unit, half away from zero.
 *
 * Every money value written to the database or returned to a client should go
 * through this rather than `toDecimalPlaces(2, ...)`. Rounding XOF to two
 * decimals is wrong twice over. It stores a precision that does not exist,
 * which is cosmetic. And it breaks the invariant that a breakdown sums to its
 * total, which is not: with `base = commission + litigation + net` each rounded
 * independently to 2dp and then displayed at 0dp, two halves can round up in
 * the same breakdown and the parts stop adding up to the whole. A driver
 * reading their earnings screen sees three numbers that do not sum, and the
 * accumulated difference -- about half a franc per delivery -- lands in the
 * ledger, which is append-only.
 *
 * Rounding to the currency's own unit first means the numbers a driver adds up
 * are the numbers that were stored.
 */
export function roundMoney(amount: Prisma.Decimal, currencyCode: string): Prisma.Decimal {
  return amount.toDecimalPlaces(currencyDecimals(currencyCode), Prisma.Decimal.ROUND_HALF_UP);
}

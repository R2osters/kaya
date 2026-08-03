import { z } from "zod";
import { parseCurrency } from "../money/currency";
import { dateLike, decimalLike, stringLike, stringLikeOrNull } from "../wire/coerce";
import { type TransactionType, transactionType } from "../wire/enums";

/** An append-only ledger row. Mirrors backend `transactions`. */
export const transactionSchema = z.object({
  id: stringLike(),
  userId: stringLike(),
  deliveryId: stringLikeOrNull(),
  type: transactionType,
  amount: decimalLike(0),
  currency: z.unknown().transform(parseCurrency),
  status: stringLike("completed"),
  reference: stringLikeOrNull(),
  createdAt: dateLike(),
});

export type Transaction = z.infer<typeof transactionSchema>;

/**
 * Types that increase the balance of the user this row belongs to; everything
 * else reduces it.
 *
 * `payment_in` is deliberately absent. It records a client paying into escrow,
 * which from that client's own ledger view is money going out — listing it as a
 * credit would render "+50 GHS" on the screen where they just spent 50.
 */
const CREDIT_TYPES: readonly TransactionType[] = [
  "escrow_release",
  "driver_payout",
  "refund",
];

export const isCredit = (t: Transaction): boolean => CREDIT_TYPES.includes(t.type);

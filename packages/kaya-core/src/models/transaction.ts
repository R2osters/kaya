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
  status: stringLike(),
  reference: stringLikeOrNull(),
  createdAt: dateLike(),
});

export type Transaction = z.infer<typeof transactionSchema>;

/** Types that increase the user's balance; everything else reduces it. */
const CREDIT_TYPES: readonly TransactionType[] = [
  "payment_in",
  "escrow_release",
  "driver_payout",
  "refund",
];

export const isCredit = (t: Transaction): boolean => CREDIT_TYPES.includes(t.type);

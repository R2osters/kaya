import { z } from "zod";
import { dateLike, dateLikeOrNull, decimalLike, jsonMap, stringLike, stringLikeOrNull } from "../wire/coerce";
import { withdrawalMethod, withdrawalStatus } from "../wire/enums";
import { roundMoney } from "../money/round";

/**
 * A payout request. Mirrors backend `withdrawals`; `accountDetails` is an
 * opaque JSONB map whose shape depends on the method and country.
 */
export const withdrawalSchema = z.object({
  id: stringLike(),
  livreurId: stringLike(),
  amount: decimalLike(0),
  method: withdrawalMethod,
  status: withdrawalStatus,
  feeAmount: decimalLike(0),
  accountDetails: jsonMap(),
  requestedAt: dateLike(),
  processedAt: dateLikeOrNull(),
  rejectionReason: stringLikeOrNull(),
});

export type Withdrawal = z.infer<typeof withdrawalSchema>;

export const withdrawalNetAmount = (w: Withdrawal): number =>
  roundMoney(w.amount - w.feeAmount);

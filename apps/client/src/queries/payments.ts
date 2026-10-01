import { queryKeys, type PaymentInit, type PaymentVerification } from "@kaya/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { api } from "../api/client";
import { paymentReturnUrl } from "../payments/openGateway";

/**
 * Starts an escrow payment for a delivery (`POST /payments/initialize`).
 *
 * Returns the gateway's authorization URL, which the payment screen opens in a
 * WebView -- Paystack in Ghana, Kkiapay in Togo and Benin, or the keyless mock
 * gateway in development. The client never sees a card or a mobile-money PIN:
 * that exchange happens entirely inside the gateway's own page.
 *
 * **Never retried.** It inherits `retry: false` from the QueryClient default
 * and does not opt out. A replayed initialize is a second escrow hold on the
 * same delivery, and money taken twice is worse for a client on a GHS 10
 * delivery than an error message is.
 */
export function useInitializePayment(): UseMutationResult<PaymentInit, unknown, string> {
  return useMutation({
    // callbackUrl rides along so the hosted checkout knows where to send the
    // user when they finish -- openPaymentGateway waits on exactly this deep
    // link. Without it the mock gateway's page ends in "return to the app
    // yourself", which on a first demo reads as the flow being broken.
    mutationFn: (deliveryId: string) =>
      api.initializePayment({ deliveryId, callbackUrl: paymentReturnUrl(deliveryId) }),
  });
}

/**
 * Confirms with the backend that a payment reference has settled
 * (`POST /payments/verify`).
 *
 * This is the client asking rather than being told. The gateway's webhook is
 * the authority and may land before the user returns from the WebView, after
 * it, or -- on a slow mobile-money confirmation -- minutes later. So this is
 * safe to call repeatedly: `verify` reads the gateway's state, it does not
 * move money, which is exactly why it is the one payment call that may be
 * polled.
 *
 * On success the delivery is invalidated: its `clientPaymentStatus` changes,
 * and the tracking screen reads it.
 */
export function useVerifyPayment(
  deliveryId: string,
): UseMutationResult<PaymentVerification, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reference: string) => api.verifyPayment({ reference }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.delivery(deliveryId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
    },
  });
}

/**
 * Payment states this app acts on, mapped from whatever string the gateway's
 * verify response carries.
 *
 * The backend passes the gateway's own vocabulary through (`success`,
 * `failed`, `pending`, and Paystack's `abandoned`), so this is where those
 * become the three outcomes a screen can render. Anything unrecognised is
 * treated as `pending` rather than as failure: telling a user their payment
 * failed when it is merely unfamiliar would send them to pay a second time.
 */
export type PaymentOutcome = "paid" | "failed" | "pending";

export function paymentOutcome(status: string): PaymentOutcome {
  switch (status.toLowerCase()) {
    case "success":
    case "paid":
    case "completed":
      return "paid";
    case "failed":
    case "abandoned":
    case "cancelled":
      return "failed";
    default:
      return "pending";
  }
}

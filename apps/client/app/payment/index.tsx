import { formatMoney, toApiFailure } from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaSkeleton,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { openPaymentGateway } from "../../src/payments/openGateway";
import {
  paymentOutcome,
  useInitializePayment,
  useVerifyPayment,
  type PaymentOutcome,
} from "../../src/queries/payments";

/**
 * Escrow payment, phase 2 slice B. Ported from
 * legacy/flutter/client/lib/features/payment/escrow_payment_screen.dart.
 *
 * Three steps, and the middle one leaves the app: initialize with the backend,
 * open the gateway's page in a system tab (see src/payments/openGateway.ts for
 * why it is not an in-app WebView), then ask the backend what happened.
 *
 * The method chooser the Dart screen has -- mobile money or card -- is not
 * ported. `InitializePaymentDto` takes a delivery id and nothing else: the
 * gateway's own page offers the methods, per country, and it is the only thing
 * that knows which are available. Two tiles that changed no request would be
 * the third piece of theatre this port has removed.
 *
 * The `/payment/webview` route is gone with the WebView. A route that exists
 * and does nothing is the dead link this project already fixed once, in the
 * route explorer.
 *
 * The screen never concludes a payment on its own. A user returning through
 * the redirect proves they finished the gateway's flow, not that money moved
 * -- the webhook is the authority, and it can land minutes later. So the
 * outcome always comes from `verify`, and `pending` is a real, displayed state
 * rather than an error.
 */
export default function PaymentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { deliveryId, amount, currency } = useLocalSearchParams<{
    deliveryId: string;
    amount?: string;
    currency?: string;
  }>();

  const initialize = useInitializePayment();
  const verify = useVerifyPayment(deliveryId);
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const pay = () => {
    // Opened without a delivery -- from a bookmark, a mistyped link, or the
    // route explorer before its entry carried params -- there is nothing to
    // pay for, and initializing with an empty id would 404 after the user had
    // already been sent to a gateway.
    if (deliveryId === undefined || deliveryId === "") return;

    setDismissed(false);
    setOutcome(null);

    initialize.mutate(deliveryId, {
      onSuccess: async (init) => {
        const returned = await openPaymentGateway(init.authorizationUrl);
        if (returned === "dismissed") {
          // Abandoning is an ordinary outcome, not a failure to report: the
          // escrow hold exists, and the same reference can be paid later.
          setDismissed(true);
          return;
        }

        verify.mutate(init.reference, {
          onSuccess: (verification) => {
            const result = paymentOutcome(verification.status);
            setOutcome(result);
            if (result === "paid") {
              router.replace(`/payment/receipt?deliveryId=${deliveryId}`);
            }
          },
        });
      },
    });
  };

  const failure = initialize.error ?? verify.error;
  const error =
    failure === null || failure === undefined ? null : toApiFailure(failure).message;

  const busy = initialize.isPending || verify.isPending;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="payment-screen"
    >
      <Text style={typography.screenTitle} testID="payment-screen-title">
        {t("payTitle")}
      </Text>

      <KayaCard testID="payment-summary">
        <Text style={typography.caption}>{t("payAmount")}</Text>
        {amount === undefined ? (
          <KayaSkeleton height={32} testID="payment-amount-loading" />
        ) : (
          <Text style={typography.screenTitle} testID="payment-amount">
            {formatMoney(Number(amount), currency === "XOF" ? "XOF" : "GHS")}
          </Text>
        )}
        <Text style={typography.caption}>{t("payEscrowNote")}</Text>
      </KayaCard>

      <Text style={typography.caption} testID="payment-gateway-note">
        {t("payGatewayNote")}
      </Text>

      {error !== null && (
        <Text style={styles.error} testID="payment-error">
          {error}
        </Text>
      )}

      {dismissed && (
        <Text style={styles.notice} testID="payment-cancelled">
          {t("payCancelled")}
        </Text>
      )}

      {outcome === "pending" && (
        <Text style={styles.notice} testID="payment-pending">
          {t("payPending")}
        </Text>
      )}

      {outcome === "failed" && (
        <Text style={styles.error} testID="payment-failed">
          {t("payCancelled")}
        </Text>
      )}

      <KayaButton
        label={t("payOpenGateway")}
        onPress={pay}
        loading={busy}
        expand
        testID="payment-pay"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  error: { ...typography.caption, color: colors.danger },
  notice: { ...typography.caption, color: colors.inkSecondary },
});

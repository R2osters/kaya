import { KayaButton, colors, spacing, typography } from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  paymentOutcome,
  useVerifyPayment,
} from "../../src/queries/payments";

/**
 * Where the payment gateway sends the user back to. The redirect carries
 * `reference` (appended by the gateway, the way Paystack appends it to a
 * callback URL) and `deliveryId` (embedded by useInitializePayment when it
 * built the callback).
 *
 * This route exists because the redirect is a *navigation*, not only a signal:
 * expo-router resolves kayaclient://payment/return like any other link, and
 * before this file existed that resolution was the Unmatched Route screen --
 * discovered by paying on the emulator, not by any test. openAuthSessionAsync
 * still gets its resolution (closing the tab is what fires it); this screen is
 * what the user actually sees while the verify runs, and the one that knows
 * where to go next.
 *
 * Same rule as the payment screen: returning proves the user finished the
 * gateway's flow, not that money moved. The outcome comes from verify, and
 * pending is a displayed state, not an error.
 */
export default function PaymentReturnScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { reference, deliveryId } = useLocalSearchParams<{
    reference?: string;
    deliveryId?: string;
  }>();

  const verify = useVerifyPayment(deliveryId ?? "");
  // Strict-mode double-mount and param re-renders must not re-fire a verify
  // that already ran; the mutation is pollable but firing it twice from one
  // arrival is noise.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (reference === undefined || reference === "") return;
    fired.current = true;
    verify.mutate(reference, {
      onSuccess: (verification) => {
        if (paymentOutcome(verification.status) === "paid") {
          router.replace(
            deliveryId === undefined || deliveryId === ""
              ? "/(tabs)/history"
              : `/payment/receipt?deliveryId=${deliveryId}`,
          );
        }
      },
    });
    // verify/router identities change per render; reference firing once is the point.
  }, [reference]);

  const outcome =
    verify.data === undefined ? null : paymentOutcome(verify.data.status);
  const failed = verify.isError || outcome === "failed";
  // Arrived without a reference: nothing to verify, only a way back to offer.
  const orphaned = reference === undefined || reference === "";

  return (
    <View style={styles.screen} testID="payment-return-screen">
      <Text style={typography.screenTitle}>{t("payTitle")}</Text>

      {verify.isPending && (
        <View style={styles.pendingRow} testID="payment-return-verifying">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.notice}>{t("payReturnVerifying")}</Text>
        </View>
      )}

      {outcome === "pending" && (
        <Text style={styles.notice} testID="payment-return-pending">
          {t("payPending")}
        </Text>
      )}

      {(failed || orphaned) && (
        <Text style={styles.error} testID="payment-return-failed">
          {t("payCancelled")}
        </Text>
      )}

      {!verify.isPending && (
        <KayaButton
          label={t("payReturnBack")}
          onPress={() =>
            deliveryId === undefined || deliveryId === ""
              ? router.replace("/(tabs)/history")
              : router.replace(`/payment?deliveryId=${deliveryId}`)
          }
          expand
          testID="payment-return-back"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  notice: { ...typography.caption, color: colors.inkSecondary, flexShrink: 1 },
  error: { ...typography.caption, color: colors.danger },
});

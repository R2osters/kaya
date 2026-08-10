import {
  currencyForCountry,
  formatMoney,
  toApiFailure,
  type Currency,
  type Delivery,
} from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaSkeletonCard,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useDelivery } from "../../src/queries/deliveries";
import { useAuthStore } from "../../src/state/authStore";

/**
 * Payment receipt, phase 2 slice B. Ported from
 * legacy/flutter/client/lib/features/payment/receipt_screen.dart.
 *
 * The Dart screen labels both the delivery price and the grand total
 * `payTotal`, so a receipt reads "Total ... Total". A receipt whose lines are
 * mislabelled is the one screen where that is least acceptable, so the first
 * row gets its own key here.
 *
 * The total is computed from the two rows above it rather than read from a
 * separate field, so what the user adds up is what they are shown. That
 * invariant is the reason `roundMoney` on the backend rounds to the currency's
 * own unit: with XOF rounded to two decimals, a breakdown could stop summing
 * to its own total once displayed at zero.
 */
export default function ReceiptScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();

  const delivery = useDelivery(deliveryId);
  const country = useAuthStore((s) => s.user?.countryCode);
  const currency: Currency = country === undefined ? "GHS" : currencyForCountry(country);

  const error =
    delivery.error === null || delivery.error === undefined
      ? null
      : toApiFailure(delivery.error).message;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="payment-receipt-screen"
    >
      <Text style={typography.screenTitle} testID="payment-receipt-screen-title">
        {t("payReceipt")}
      </Text>

      {error !== null && (
        <Text style={styles.error} testID="receipt-error">
          {error}
        </Text>
      )}

      {delivery.isPending || delivery.data === undefined ? (
        <KayaSkeletonCard testID="receipt-loading" />
      ) : (
        <Breakdown delivery={delivery.data} currency={currency} />
      )}

      <KayaButton
        label={t("trackTitle")}
        onPress={() => router.replace(`/tracking/${deliveryId}`)}
        expand
        testID="receipt-track"
      />
    </ScrollView>
  );
}

function Breakdown({ delivery, currency }: { delivery: Delivery; currency: Currency }) {
  const { t } = useTranslation();

  const price = delivery.basePrice ?? 0;
  const fee = delivery.litigationFee;
  const total = price + fee;

  return (
    <KayaCard testID="receipt-card">
      <Text style={typography.caption}>{t("payEscrowNote")}</Text>

      <Row
        label={t("orderNumber")}
        // The Dart original slices the id to eight characters and upper-cases
        // it; a full uuid is not something anyone reads out over the phone.
        value={`#${delivery.orderId.slice(0, 8).toUpperCase()}`}
        testID="receipt-order"
      />
      <Row
        label={t("payDeliveryPrice")}
        value={formatMoney(price, currency)}
        testID="receipt-price"
      />
      <Row
        label={t("payLitigationFee")}
        value={formatMoney(fee, currency)}
        testID="receipt-fee"
      />
      <Row label={t("payTotal")} value={formatMoney(total, currency)} strong testID="receipt-total" />
    </KayaCard>
  );
}

function Row({
  label,
  value,
  strong = false,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={strong ? typography.bodyStrong : typography.body} testID={`${testID}-value`}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  error: { ...typography.caption, color: colors.danger },
});

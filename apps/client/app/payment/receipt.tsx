import {
  currencyForCountry,
  formatMoney,
  toApiFailure,
  type Currency,
  type Delivery,
} from "@kaya/core";
import {
  ENTER_MS,
  KayaAnimatedListItem,
  KayaButton,
  KayaCard,
  KayaSkeletonCard,
  KayaScreenHeader,
  colors,
  radii,
  spacing,
  springs,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { useGoBack } from "../../src/navigation/useGoBack";
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
  const goBack = useGoBack();
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
      <KayaScreenHeader title={t("payReceipt")} onBack={goBack} testID="payment-receipt-screen" />

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
      {/* The moment the money left. A receipt that fades in as a block of
          numbers says a page loaded; a mark that lands first, then rows that
          arrive under it, says something completed -- which is the only thing
          the user is on this screen to find out. */}
      <PaidMark />

      <Text style={typography.caption}>{t("payEscrowNote")}</Text>

      <Row
        label={t("orderNumber")}
        // The Dart original slices the id to eight characters and upper-cases
        // it; a full uuid is not something anyone reads out over the phone.
        value={`#${delivery.orderId.slice(0, 8).toUpperCase()}`}
        index={0}
        testID="receipt-order"
      />
      <Row
        label={t("payDeliveryPrice")}
        value={formatMoney(price, currency)}
        index={1}
        testID="receipt-price"
      />
      <Row
        label={t("payLitigationFee")}
        value={formatMoney(fee, currency)}
        index={2}
        testID="receipt-fee"
      />
      <Row
        label={t("payTotal")}
        value={formatMoney(total, currency)}
        strong
        index={3}
        testID="receipt-total"
      />
    </KayaCard>
  );
}

/**
 * The paid mark: a tick that lands once, on arrival.
 *
 * Deliberately a single settle rather than anything that repeats or lingers.
 * The escrow is held, not spent -- the client's money is committed but the
 * driver has not been paid yet -- so this is an acknowledgement, not a
 * celebration, and the copy beside it (`payEscrowNote`) is what explains the
 * difference.
 */
function PaidMark() {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      ENTER_MS / 2,
      withSpring(1, { ...springs.sheet, reduceMotion: ReduceMotion.System }),
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={[styles.paidMark, animatedStyle]} testID="receipt-paid-mark">
      <Check size={22} color={colors.success} strokeWidth={3} />
    </Animated.View>
  );
}

function Row({
  label,
  value,
  strong = false,
  index,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  index: number;
  testID: string;
}) {
  return (
    <KayaAnimatedListItem index={index}>
      <View style={styles.row} testID={testID}>
        <Text style={typography.caption}>{label}</Text>
        <Text style={strong ? typography.bodyStrong : typography.body} testID={`${testID}-value`}>
          {value}
        </Text>
      </View>
    </KayaAnimatedListItem>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  paidMark: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.successTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  error: { ...typography.caption, color: colors.danger },
});

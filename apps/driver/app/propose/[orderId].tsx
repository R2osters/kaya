import {
  commissionPreview,
  currencyDecimals,
  formatMoney,
  toApiFailure,
  userCurrency,
} from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaPressable,
  KayaSkeletonCard,
  KayaScreenHeader,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../../src/navigation/useGoBack";
import { useCountryConfig } from "../../src/queries/countryConfig";
import { useDriverStats } from "../../src/queries/driver";
import { useCreateOffer, useOrder } from "../../src/queries/offers";
import { useAuthStore } from "../../src/state/authStore";

/**
 * Bid on an order, phase 3. Ported from
 * legacy/flutter/driver/lib/features/offer/propose_price_screen.dart.
 *
 * The screen is one number and what that number is worth. A driver deciding
 * whether a run pays is not doing arithmetic on a 20 % commission and a
 * litigation fee in their head at a junction; the breakdown under the price is
 * the whole point of the screen, and it updates as they step the price.
 *
 * Both inputs to that breakdown come from the country's tariff card rather
 * than from constants -- see src/queries/countryConfig.ts for why. The
 * delivery ordinal comes from `/driver/stats`: commission steps down at the
 * 7th, 11th and 15th run of the day, so the same price is worth more later in
 * a shift, and the driver can see that.
 *
 * The Dart original's slider is not ported. A slider sets a price by pixel,
 * which on a 3 GHS step means a fat finger costs real money; the stepper and
 * the typed floor are exact.
 */
export default function ProposePriceScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const user = useAuthStore((s) => s.user);
  const currency = user === null || user === undefined ? "GHS" : userCurrency(user);

  const order = useOrder(orderId ?? "");
  const config = useCountryConfig();
  const stats = useDriverStats();
  const createOffer = useCreateOffer(orderId ?? "");

  // `undefined` means "the driver has not moved it", which is different from
  // having chosen the minimum: the floor is only known once the order loads,
  // and defaulting to 0 before then would show a bid nobody can place.
  const [chosen, setChosen] = useState<number | undefined>(undefined);

  if (order.isPending || config.isPending) {
    return (
      <View style={styles.screen} testID="propose-screen">
        <KayaSkeletonCard testID="propose-loading" />
      </View>
    );
  }

  if (order.data === undefined || config.data === undefined) {
    return (
      <View style={styles.screen} testID="propose-screen">
        <Text style={styles.error} testID="propose-load-error">
          {t("commonError")}
        </Text>
      </View>
    );
  }

  const minimum = order.data.minPriceSuggested ?? 0;
  const price = chosen ?? minimum;
  // The step is the currency's own smallest useful unit: a franc-denominated
  // bid moved by 0.01 XOF would be a bid that never changes.
  const step = currencyDecimals(currency) === 0 ? 50 : 1;

  const preview = commissionPreview({
    grossPrice: price,
    completedToday: stats.data?.dailyDeliveries ?? 0,
    litigationFee: config.data.litigationFee,
    commissionTiers: config.data.commissionTiers,
    currency,
  });

  const submitError =
    createOffer.error === null || createOffer.error === undefined
      ? null
      : toApiFailure(createOffer.error).message;

  const submit = () => {
    createOffer.mutate(price, {
      // Home, not back: the order the driver just bid on is no longer
      // something to act on, and returning to it invites a second tap that
      // can only 409 (one bid per driver per order).
      onSuccess: () => router.replace("/(tabs)/home"),
    });
  };

  return (
    <View style={styles.screen} testID="propose-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <KayaScreenHeader title={t("driverProposePrice")} onBack={goBack} testID="propose-screen" />

        <View style={styles.route}>
          <RouteLeg label={t("orderPickup")} value={order.data.pickupAddress} tint={colors.success} />
          <RouteLeg
            label={t("orderDropoff")}
            value={order.data.deliveryAddress}
            tint={colors.primary}
          />
        </View>

        {/* priceXL, the one style above priceLarge, and this is the screen it
            exists for: the driver is *editing* this number, one-handed, in
            sunlight, often propped on a bike. 26 is the right size to read a
            price and too small to edit one. */}
        <View style={styles.priceBlock}>
          <Text
            style={[typography.priceXL, price <= minimum && styles.priceAtFloor]}
            testID="propose-price"
          >
            {formatMoney(price, currency)}
          </Text>
          <Text style={typography.caption}>
            {t("driverMinimum")} · {formatMoney(minimum, currency)}
          </Text>
        </View>

        <View style={styles.stepper}>
          <StepButton
            icon={<Minus size={24} color={colors.primary} />}
            // The floor is the backend's rule, not a nicety: a bid under
            // minPriceSuggested is rejected, so the stepper simply cannot
            // reach one.
            onPress={() => setChosen(Math.max(minimum, price - step))}
            disabled={price <= minimum}
            testID="propose-decrease"
          />
          <StepButton
            icon={<Plus size={24} color={colors.primary} />}
            onPress={() => setChosen(price + step)}
            testID="propose-increase"
          />
        </View>

        {/* The net is what the driver actually decides on, so the card that
            carries it is toned as money kept (success) rather than as one more
            neutral panel, and the two deductions above it are visibly
            deductions. What is taken is stated before what is left. */}
        <KayaCard color={colors.successTint} border={false} testID="propose-breakdown">
          <BreakdownRow
            label={`${t("driverCommission")} (${preview.ratePercent}%)`}
            value={`- ${formatMoney(preview.commission, currency)}`}
            tone={colors.danger}
          />
          <View style={styles.divider} />
          <BreakdownRow
            label={t("payLitigationFee")}
            value={`- ${formatMoney(preview.litigationFee, currency)}`}
            tone={colors.danger}
          />
          <View style={styles.divider} />
          <BreakdownRow
            label={t("driverNetAfterCommission")}
            value={formatMoney(preview.net, currency)}
            strong
            tone={colors.success}
          />
        </KayaCard>

        <Text style={typography.caption} testID="propose-tier">
          {t("driverTierLine", { number: preview.deliveryNumber, pct: preview.ratePercent })}
        </Text>

        {submitError !== null && (
          <Text style={styles.error} testID="propose-error">
            {submitError}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <KayaButton
          label={t("actionConfirm")}
          onPress={submit}
          loading={createOffer.isPending}
          expand
          testID="propose-submit"
        />
      </View>
    </View>
  );
}

function RouteLeg({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={styles.leg}>
      <View style={[styles.legDot, { backgroundColor: tint }]} />
      <View style={styles.legText}>
        <Text style={typography.overline}>{label}</Text>
        <Text style={typography.bodyStrong} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  disabled = false,
  testID,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  return (
    <KayaPressable
      onPress={disabled ? () => undefined : onPress}
      style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
      testID={testID}
    >
      {icon}
    </KayaPressable>
  );
}

function BreakdownRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  /** Colours the amount: deductions read danger, what is kept reads success. */
  tone?: string;
}) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={strong ? typography.sectionTitle : typography.bodySecondary}>{label}</Text>
      <Text
        style={[
          strong ? typography.priceLarge : typography.bodyStrong,
          tone === undefined ? null : { color: tone },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  route: { gap: spacing.md },
  leg: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  legDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  legText: { flex: 1 },
  priceBlock: { alignItems: "center", gap: spacing.xs, paddingTop: spacing.md },
  // Sitting on the floor is not an error -- the backend's minimum is a valid
  // bid -- but it is the one value the driver cannot go below, and the colour
  // says so before the disabled stepper does.
  priceAtFloor: { color: colors.inkSecondary },
  stepper: { flexDirection: "row", justifyContent: "center", gap: spacing.xxxl },
  stepButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonDisabled: { opacity: 0.4 },
  breakdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.md,
  },
  footer: { padding: spacing.xxl, paddingTop: spacing.md },
  error: { ...typography.caption, color: colors.danger },
});

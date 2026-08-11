import { formatMoney, type DriverEarning } from "@kaya/core";
import {
  EmptyState,
  KayaButton,
  KayaCard,
  KayaSkeletonList,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Wallet } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useDriverBalance, useDriverStats } from "../../src/queries/driver";
import { useDriverEarnings } from "../../src/queries/withdrawals";

/**
 * Money, phase 3. Ported from
 * legacy/flutter/driver/lib/features/earnings/earnings_screen.dart.
 *
 * Balance first, because that is the number a driver opens this tab to see,
 * and the withdraw button next to it because it is the only thing they can do
 * with it. Below, the per-delivery rows that explain how the balance got
 * there: gross, what commission took, what is left.
 *
 * The rows come from `/driver/earnings`, which returns settled deliveries
 * only (`driverPayoutStatus: processed`). Showing an unsettled run here would
 * be promising money that has not moved.
 */
export default function EarningsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const balance = useDriverBalance();
  const stats = useDriverStats();
  const earnings = useDriverEarnings();

  const currency = balance.data?.currency ?? stats.data?.currency ?? "GHS";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="earnings-screen"
    >
      <Text style={typography.screenTitle} testID="earnings-screen-title">
        {t("navEarnings")}
      </Text>

      <KayaCard color={colors.primary} border={false} testID="earnings-balance">
        <Text style={[typography.caption, styles.onPrimary]}>{t("driverAvailableBalance")}</Text>
        <Text style={[typography.priceLarge, styles.onPrimary]} testID="earnings-balance-amount">
          {balance.data === undefined ? "—" : formatMoney(balance.data.balance, currency)}
        </Text>
      </KayaCard>

      <View style={styles.statRow}>
        <StatTile
          label={t("driverTodayEarnings")}
          value={
            stats.data === undefined ? "—" : formatMoney(stats.data.todayEarnings, currency)
          }
          testID="earnings-today"
        />
        <StatTile
          label={t("driverTotalDeliveries")}
          value={stats.data === undefined ? "—" : String(stats.data.totalDeliveries)}
          testID="earnings-total-deliveries"
        />
      </View>

      <KayaButton
        label={t("driverWithdraw")}
        onPress={() => router.push("/withdraw")}
        icon={(color) => <Wallet size={20} color={color} />}
        expand
        testID="earnings-withdraw"
      />

      <Text style={typography.sectionTitle}>{t("driverRecentActivity")}</Text>

      {earnings.isPending ? (
        <KayaSkeletonList count={3} testID="earnings-loading" />
      ) : (earnings.data ?? []).length === 0 ? (
        <EmptyState
          icon={(color) => <Wallet size={28} color={color} />}
          title={t("driverEarningsEmpty")}
          testID="earnings-empty"
        />
      ) : (
        (earnings.data ?? []).map((row, index) => (
          <EarningRow key={row.deliveryId} earning={row} currency={currency} index={index} />
        ))
      )}
    </ScrollView>
  );
}

function StatTile({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}) {
  return (
    <View style={styles.tile}>
      <KayaCard testID={testID}>
        <Text style={typography.caption} numberOfLines={1}>
          {label}
        </Text>
        <Text style={typography.price}>{value}</Text>
      </KayaCard>
    </View>
  );
}

function EarningRow({
  earning,
  currency,
  index,
}: {
  earning: DriverEarning;
  currency: "GHS" | "XOF" | "NGN";
  index: number;
}) {
  const { t } = useTranslation();

  return (
    <KayaCard testID={`earnings-row-${index}`}>
      <View style={styles.rowHead}>
        <Text style={typography.bodyStrong} numberOfLines={1}>
          {earning.clientName ?? "—"}
        </Text>
        <Text style={[typography.price, styles.net]}>
          {earning.netEarnings === null ? "—" : formatMoney(earning.netEarnings, currency)}
        </Text>
      </View>
      <Text style={typography.caption}>
        {earning.basePrice === null ? "—" : formatMoney(earning.basePrice, currency)}
        {earning.commissionAmount === null
          ? ""
          : ` · ${t("driverCommission")} -${formatMoney(earning.commissionAmount, currency)}`}
      </Text>
    </KayaCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.md, paddingBottom: spacing.xxxl },
  onPrimary: { color: colors.surface },
  statRow: { flexDirection: "row", gap: spacing.md },
  tile: { flex: 1 },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  net: { color: colors.success },
});

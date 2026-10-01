import { formatMoney } from "@kaya/core";
import {
  KayaAvatar,
  KayaCard,
  KayaSkeletonCard,
  KayaScreenHeader,
  StatusPill,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../../src/navigation/useGoBack";
import { useDelivery } from "../../src/queries/deliveries";
import { useDriverBalance } from "../../src/queries/driver";

/**
 * One finished run, phase 3. Ported from
 * legacy/flutter/driver/lib/features/history/delivery_detail_screen.dart.
 *
 * The receipt for a delivery: where it went, who it was for, and the money
 * broken out the way the ledger recorded it -- gross, commission at the rate
 * that applied that run, litigation fee, net. A driver querying a payout is
 * querying these four numbers, so they are shown as they were stored rather
 * than recomputed here, where a rounding rule could disagree with the ledger.
 */
export default function DeliveryDetailScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();

  const delivery = useDelivery(deliveryId ?? "");
  const balance = useDriverBalance();
  const currency = balance.data?.currency ?? "GHS";

  if (delivery.isPending) {
    return (
      <View style={styles.screen} testID="delivery-detail-screen">
        <KayaSkeletonCard testID="delivery-detail-loading" />
      </View>
    );
  }

  const data = delivery.data;
  const order = data?.order ?? null;
  const client = order?.client ?? null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="delivery-detail-screen"
    >
      <View style={styles.header}>
        <KayaScreenHeader title={t("screenDeliveryDetail")} onBack={goBack} testID="delivery-detail-screen" />
        {data !== undefined && (
          <StatusPill label={data.status} testID="delivery-detail-status" />
        )}
      </View>

      <KayaCard testID="delivery-detail-route">
        <Leg label={t("orderPickup")} value={order?.pickupAddress ?? "—"} tint={colors.success} />
        <View style={styles.legSpacer} />
        <Leg
          label={t("orderDropoff")}
          value={order?.deliveryAddress ?? "—"}
          tint={colors.primary}
        />
      </KayaCard>

      {client !== null && (
        <KayaCard testID="delivery-detail-client">
          <View style={styles.clientRow}>
            <KayaAvatar name={client.fullName} photoUrl={client.profilePhoto ?? undefined} />
            <View style={styles.clientText}>
              <Text style={typography.bodyStrong}>{client.fullName}</Text>
              <Text style={typography.caption}>{client.phone}</Text>
            </View>
          </View>
        </KayaCard>
      )}

      <KayaCard testID="delivery-detail-money">
        <MoneyRow
          label={t("payDeliveryPrice")}
          value={data?.basePrice === null || data === undefined ? "—" : formatMoney(data.basePrice, currency)}
        />
        <View style={styles.divider} />
        <MoneyRow
          label={`${t("driverCommission")}${
            data?.commissionRate == null ? "" : ` (${Math.round(data.commissionRate * 100)}%)`
          }`}
          value={
            data?.commissionAmount == null
              ? "—"
              : `- ${formatMoney(data.commissionAmount, currency)}`
          }
        />
        <View style={styles.divider} />
        <MoneyRow
          label={t("payLitigationFee")}
          value={data === undefined ? "—" : `- ${formatMoney(data.litigationFee, currency)}`}
        />
        <View style={styles.divider} />
        <MoneyRow
          label={t("driverNetAfterCommission")}
          value={
            data?.netEarnings == null ? "—" : formatMoney(data.netEarnings, currency)
          }
          strong
          testID="delivery-detail-net"
        />
      </KayaCard>
    </ScrollView>
  );
}

function Leg({ label, value, tint }: { label: string; value: string; tint: string }) {
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

function MoneyRow({
  label,
  value,
  strong = false,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.moneyRow} testID={testID}>
      <Text style={strong ? typography.sectionTitle : typography.bodySecondary}>{label}</Text>
      <Text style={strong ? [typography.price, styles.net] : typography.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leg: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  legDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  legText: { flex: 1 },
  legSpacer: { height: spacing.md },
  clientRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  clientText: { flex: 1 },
  moneyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.md },
  net: { color: colors.success },
});

import { formatMoney, type Delivery } from "@kaya/core";
import {
  EmptyState,
  KayaCard,
  KayaPressable,
  KayaSkeletonList,
  StatusPill,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Package } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useMyDeliveries } from "../src/queries/deliveries";
import { useDriverBalance } from "../src/queries/driver";

/**
 * Delivery history, phase 3. Ported from
 * legacy/flutter/driver/lib/features/history/delivery_history_screen.dart.
 *
 * Runs, newest first, with what each one paid. A row opens its detail: on a
 * finished delivery that is the receipt, on a live one it is the run itself,
 * which is the same routing rule the client's history learned the hard way --
 * sending a driver back to a screen whose only button posts a transition the
 * backend refuses is a dead end, not a shortcut.
 */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const deliveries = useMyDeliveries();
  const balance = useDriverBalance();
  const currency = balance.data?.currency ?? "GHS";

  const rows = deliveries.data ?? [];

  return (
    <View style={styles.screen} testID="history-screen">
      <Text style={typography.screenTitle} testID="history-screen-title">
        {t("screenHistory")}
      </Text>

      {deliveries.isPending ? (
        <KayaSkeletonList count={4} testID="history-loading" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={(color) => <Package size={28} color={color} />}
          title={t("historyEmpty")}
          testID="history-empty"
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(delivery) => delivery.id}
          contentContainerStyle={styles.list}
          testID="history-list"
          renderItem={({ item, index }) => (
            <HistoryRow
              delivery={item}
              currency={currency}
              index={index}
              onPress={() =>
                router.push(
                  item.status === "in_progress"
                    ? `/delivery/${item.id}`
                    : `/delivery-detail/${item.id}`,
                )
              }
            />
          )}
        />
      )}
    </View>
  );
}

function HistoryRow({
  delivery,
  currency,
  index,
  onPress,
}: {
  delivery: Delivery;
  currency: "GHS" | "XOF" | "NGN";
  index: number;
  onPress: () => void;
}) {
  return (
    <KayaPressable onPress={onPress} testID={`history-delivery-${index}`}>
      <KayaCard>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={typography.bodyStrong} numberOfLines={1}>
              {delivery.order?.deliveryAddress ?? delivery.orderId}
            </Text>
            <Text style={typography.caption} numberOfLines={1}>
              {delivery.order?.pickupAddress ?? ""}
            </Text>
          </View>
          <View style={styles.rowEnd}>
            <Text style={typography.bodyStrong}>
              {delivery.netEarnings === null
                ? "—"
                : formatMoney(delivery.netEarnings, currency)}
            </Text>
            <StatusPill label={delivery.status} testID={`history-delivery-${index}-status`} />
          </View>
        </View>
      </KayaCard>
    </KayaPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowText: { flex: 1 },
  rowEnd: { alignItems: "flex-end", gap: spacing.xs },
});

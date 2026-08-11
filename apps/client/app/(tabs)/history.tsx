import { type Order } from "@kaya/core";
import {
  EmptyState,
  KayaCard,
  KayaSkeletonList,
  StatusPill,
  colors,
  radii,
  spacing,
  typography,
  KayaPressable,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Package } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {FlatList, StyleSheet, Text, View} from "react-native";
import { useMyDeliveries } from "../../src/queries/inbox";
import { splitHistory, useMyOrders } from "../../src/queries/orderList";

type Tab = "past" | "upcoming";

/**
 * Order history, phase 2 slice D. Ported from
 * legacy/flutter/client/lib/features/history/history_screen.dart.
 *
 * Two lists from one request. The split is in `splitHistory` rather than here
 * because it is the only judgement on this screen and `isScheduled` alone does
 * not make it: a scheduled order that has been delivered belongs in the past.
 *
 * Tapping a row goes to the order's *current* screen, not always the offers:
 * once an offer is accepted a delivery exists, and the offers screen for an
 * accepted order is a dead end whose Accept button can only 409. The first
 * live course surfaced this -- history led back to a bidding war that was
 * already over. Orders do not carry their delivery, so the deliveries list
 * (already cached for the inbox) provides the mapping.
 */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("past");

  const orders = useMyOrders();
  const deliveries = useMyDeliveries();
  const { upcoming, past } = splitHistory(orders.data?.data ?? []);
  const rows = tab === "past" ? past : upcoming;

  const deliveryFor = (orderId: string) =>
    deliveries.data?.find((d) => d.orderId === orderId);

  return (
    <View style={styles.screen} testID="history-screen">
      <Text style={typography.screenTitle} testID="history-screen-title">
        {t("navHistory")}
      </Text>

      <View style={styles.tabs} testID="history-tabs">
        {(["past", "upcoming"] as const).map((value) => (
          <KayaPressable
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabSelected]}
            testID={`history-tab-${value}`}
          >
            <Text style={[typography.body, tab === value && styles.tabSelectedLabel]}>
              {t(value === "past" ? "historyPast" : "historyScheduled")}
            </Text>
          </KayaPressable>
        ))}
      </View>

      {orders.isPending ? (
        <KayaSkeletonList count={3} testID="history-loading" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={(color) => <Package size={28} color={color} />}
          title={t("historyEmpty")}
          testID="history-empty"
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.list}
          testID="history-list"
          renderItem={({ item, index }) => (
            <OrderRow
              order={item}
              index={index}
              onPress={() => {
                const delivery = deliveryFor(item.id);
                router.push(
                  delivery === undefined
                    ? `/offers/${item.id}`
                    : `/tracking/${delivery.id}`,
                );
              }}
            />
          )}
        />
      )}
    </View>
  );
}

function OrderRow({
  order,
  index,
  onPress,
}: {
  order: Order;
  index: number;
  onPress: () => void;
}) {
  return (
    <KayaPressable onPress={onPress} testID={`history-order-${index}`}>
      <KayaCard>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={typography.bodyStrong}>{order.deliveryAddress}</Text>
            <Text style={typography.caption}>{order.pickupAddress}</Text>
          </View>
          {/* The status is the backend's own vocabulary; translating it here
              would mean a second place that has to learn every new state. */}
          <StatusPill label={order.status} testID={`history-order-${index}-status`} />
        </View>
      </KayaCard>
    </KayaPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.md },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  tabSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  tabSelectedLabel: { color: colors.primary },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowText: { flex: 1 },
});

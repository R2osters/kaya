import { type Order } from "@kaya/core";
import {
  EmptyState,
  KayaCard,
  KayaSkeletonList,
  MapView,
  colors,
  dropoffMarker,
  spacing,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Bell, Package, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMyOrders, splitHistory } from "../../src/queries/orderList";

/** How many recent drop-offs the home screen offers as shortcuts. */
const RECENT_LIMIT = 3;

/**
 * Home, phase 2 slice D. Ported from
 * legacy/flutter/client/lib/features/home/home_screen.dart.
 *
 * The map at the top is not a tracking view -- it shows where this client has
 * had things delivered, which is what makes the recent drop-offs below it
 * useful rather than decorative. With no history it renders empty, and the
 * screen is still usable: the point of the screen is the "what needs moving?"
 * action, and a new user has no history by definition.
 *
 * The scheduled-order shortcut is not here. Scheduling is not built (see the
 * slice A design doc), and a tile that opens create-order without a date would
 * be a lie about what the app can do.
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const orders = useMyOrders();

  const past = orders.data === undefined ? [] : splitHistory(orders.data.data).past;
  const recent = past.slice(0, RECENT_LIMIT);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="home-screen">
      <View style={styles.header}>
        <Text style={typography.screenTitle} testID="home-screen-title">
          {t("homeWhatMoving")}
        </Text>
        <Pressable onPress={() => router.push("/notifications")} testID="home-notifications">
          <Bell size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.map}>
        <MapView markers={recent.map((o) => dropoffMarker(o.dropoff))} testID="home-map" />
      </View>

      <Pressable onPress={() => router.push("/create-order")} testID="home-search">
        <KayaCard>
          <View style={styles.searchRow}>
            <Search size={18} color={colors.inkTertiary} />
            <Text style={typography.body}>{t("homeSearchHint")}</Text>
          </View>
        </KayaCard>
      </Pressable>

      <Text style={typography.overline}>{t("homeRecentDropoffs")}</Text>

      {orders.isPending ? (
        <KayaSkeletonList count={2} testID="home-recent-loading" />
      ) : recent.length === 0 ? (
        <EmptyState
          icon={(color) => <Package size={28} color={color} />}
          title={t("historyEmpty")}
          testID="home-recent-empty"
        />
      ) : (
        recent.map((order, index) => (
          <RecentDropoff
            key={order.id}
            order={order}
            index={index}
            onPress={() => router.push("/create-order")}
          />
        ))
      )}
    </ScrollView>
  );
}

function RecentDropoff({
  order,
  index,
  onPress,
}: {
  order: Order;
  index: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} testID={`home-recent-${index}`}>
      <KayaCard>
        <Text style={typography.bodyStrong}>{order.deliveryAddress}</Text>
        <Text style={typography.caption}>{order.pickupAddress}</Text>
      </KayaCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  map: { height: 180, borderRadius: 20, overflow: "hidden" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});

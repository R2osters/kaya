import { type Order } from "@kaya/core";
import {
  EmptyState,
  KayaCard,
  KayaPressable,
  KayaSkeletonList,
  MapView,
  colors,
  dropoffMarker,
  radii,
  shadows,
  spacing,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Bell, MapPin, Package, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMyOrders, splitHistory } from "../../src/queries/orderList";
import { useAuthStore } from "../../src/state/authStore";

/** How many recent drop-offs the home screen offers as shortcuts. */
const RECENT_LIMIT = 3;

/**
 * Home, phase 2 slice D — map-first, the way a delivery app orients.
 *
 * The map is the hero: edge-to-edge under the status bar, with the greeting
 * and the bell floating over it and the search pill overlapping its bottom
 * edge. That overlap is deliberate spatial grammar (the pill belongs to both
 * worlds: it is *on* the map and it *starts* the flow below it), and it is
 * the pattern the user's own benchmarks — Uber, Bolt — trained everyone on.
 *
 * The pill is the single dominant action. Everything else on the screen is
 * quieter than it on purpose: one obvious thing to do per screen.
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const orders = useMyOrders();
  const firstName = useAuthStore((s) => s.user?.fullName.split(" ")[0]);

  const past = orders.data === undefined ? [] : splitHistory(orders.data.data).past;
  const recent = past.slice(0, RECENT_LIMIT);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="home-screen"
    >
      <View style={styles.hero}>
        <MapView markers={recent.map((o) => dropoffMarker(o.dropoff))} testID="home-map" />

        {/* Floating chrome over the map, pushed below the status bar. */}
        <View style={[styles.heroBar, { top: insets.top + spacing.md }]}>
          <Text style={[typography.screenTitle, styles.heroTitle]} testID="home-screen-title">
            {firstName === undefined ? t("homeWhatMoving") : `${t("homeWhatMoving")}`}
          </Text>
          <KayaPressable
            onPress={() => router.push("/notifications")}
            style={styles.bell}
            testID="home-notifications"
          >
            <Bell size={20} color={colors.ink} />
          </KayaPressable>
        </View>
      </View>

      {/* The search pill straddles the map's bottom edge. */}
      <View style={styles.pillWrap}>
        <KayaPressable
          onPress={() => router.push("/create-order")}
          style={styles.pill}
          testID="home-search"
        >
          <Search size={20} color={colors.ink} />
          <Text style={[typography.bodyStrong, styles.pillLabel]}>{t("homeSearchHint")}</Text>
        </KayaPressable>
      </View>

      <View style={styles.body}>
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
      </View>
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
    <KayaPressable onPress={onPress} testID={`home-recent-${index}`}>
      <KayaCard>
        <View style={styles.recentRow}>
          <View style={styles.recentIcon}>
            <MapPin size={16} color={colors.primary} />
          </View>
          <View style={styles.recentText}>
            <Text style={typography.bodyStrong} numberOfLines={1}>
              {order.deliveryAddress}
            </Text>
            <Text style={typography.caption} numberOfLines={1}>
              {order.pickupAddress}
            </Text>
          </View>
        </View>
      </KayaCard>
    </KayaPressable>
  );
}

const PILL_HEIGHT = 56;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  hero: { height: 320 },
  heroBar: {
    position: "absolute",
    left: spacing.xxl,
    right: spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroTitle: { flex: 1 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  pillWrap: {
    marginTop: -PILL_HEIGHT / 2,
    paddingHorizontal: spacing.xxl,
  },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    ...shadows.card,
  },
  pillLabel: { flex: 1 },
  body: { padding: spacing.xxl, gap: spacing.md },
  recentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  recentText: { flex: 1 },
});

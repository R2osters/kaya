import { formatMoney, userCurrency, type Currency, type NearbyOrder } from "@kaya/core";
import {
  EmptyState,
  KayaCard,
  KayaPressable,
  KayaSkeletonList,
  MapView,
  colors,
  pickupMarker,
  radii,
  shadows,
  spacing,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Bell, Navigation, Package } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDriverLocation } from "../../src/location/useDriverLocation";
import { useActiveDelivery } from "../../src/queries/deliveries";
import { useDriverStats, useSetOnline } from "../../src/queries/driver";
import { useNearbyOrders } from "../../src/queries/nearby";
import { useAuthStore } from "../../src/state/authStore";

/**
 * The driver's home: the only screen they look at between runs.
 *
 * Three things, in the order a driver needs them. Am I online (and therefore
 * earning)? What have I made today? What work is there right now? The map sits
 * behind all of it because it is the one piece of context that answers "where
 * is this work relative to me" without being read.
 *
 * The online switch is the screen's centre of gravity, not a setting. Offline,
 * `OffersService` refuses every bid, so the switch is the difference between
 * an app that works and one that silently does nothing -- which is exactly
 * what happened before `POST /driver/status` existed.
 *
 * Position is published while online rather than only during a run: the nearby
 * search needs a fix before any delivery exists, and a driver who vanishes
 * from the map the moment they finish a run is a driver dispatch cannot see.
 */
export default function DriverHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const online = user?.isOnline ?? false;
  const currency = user === null || user === undefined ? "GHS" : userCurrency(user);

  const location = useDriverLocation(online);
  const setOnline = useSetOnline();
  const stats = useDriverStats();
  const nearby = useNearbyOrders(location.position, online);
  const active = useActiveDelivery();

  const toggle = (next: boolean) => {
    // Ask for location on the way in, not at launch: a permission prompt on
    // first open, before the app has shown what it needs it for, is the one
    // most often refused outright.
    if (next && location.permission !== "granted") {
      void location.request();
    }
    setOnline.mutate(next);
  };

  return (
    <View style={styles.screen} testID="home-screen">
      <View style={StyleSheet.absoluteFill}>
        <MapView
          center={location.position ?? undefined}
          markers={(nearby.data ?? []).map((order) => pickupMarker(order.pickup))}
          showUserLocation
          testID="home-map"
        />
      </View>

      <View style={[styles.floating, { paddingTop: insets.top + spacing.md }]}>
        <KayaCard testID="home-status-card">
          <View style={styles.statusRow}>
            <View style={styles.statusText}>
              <Text style={typography.sectionTitle}>
                {online ? t("driverOnline") : t("driverOffline")}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {online ? t("driverNearbyRequests") : t("driverOfflineHint")}
              </Text>
            </View>

            {setOnline.isPending ? (
              <ActivityIndicator color={colors.primary} testID="home-online-pending" />
            ) : (
              <Switch
                value={online}
                onValueChange={toggle}
                trackColor={{ true: colors.success, false: colors.border }}
                testID="home-online-toggle"
              />
            )}

            <KayaPressable
              onPress={() => router.push("/notifications")}
              style={styles.bell}
              testID="home-notifications"
            >
              <Bell size={20} color={colors.ink} />
            </KayaPressable>
          </View>
        </KayaCard>

        <KayaCard color={colors.primary} border={false} testID="home-today-earnings">
          <View style={styles.earningsRow}>
            <Text style={[typography.bodyStrong, styles.onPrimary]}>
              {t("driverTodayEarnings")}
            </Text>
            <Text style={[typography.price, styles.onPrimary]} testID="home-today-amount">
              {stats.data === undefined
                ? "—"
                : formatMoney(stats.data.todayEarnings, stats.data.currency)}
            </Text>
          </View>
        </KayaCard>

        {location.permission === "denied" && (
          <KayaCard testID="home-location-denied">
            <Text style={typography.caption}>{t("driverLocationNeeded")}</Text>
            <KayaPressable onPress={() => void location.request()} testID="home-location-request">
              <Text style={[typography.bodyStrong, styles.link]}>{t("driverEnableLocation")}</Text>
            </KayaPressable>
          </KayaCard>
        )}
      </View>

      <View style={styles.sheet} testID="home-sheet">
        <View style={styles.grabber} />

        {active !== undefined ? (
          <KayaPressable
            onPress={() => router.push(`/delivery/${active.id}`)}
            testID="home-active-delivery"
          >
            <KayaCard>
              <View style={styles.activeRow}>
                <View style={styles.activeIcon}>
                  <Navigation size={18} color={colors.primary} />
                </View>
                <View style={styles.activeText}>
                  <Text style={typography.bodyStrong}>{t("driverActiveDelivery")}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {active.order?.deliveryAddress ?? t("driverResumeRun")}
                  </Text>
                </View>
              </View>
            </KayaCard>
          </KayaPressable>
        ) : null}

        <Text style={typography.sectionTitle}>{t("driverNearbyRequests")}</Text>

        <ScrollView contentContainerStyle={styles.list} testID="home-nearby-list">
          {!online ? (
            <EmptyState
              icon={(color) => <Package size={28} color={color} />}
              title={t("driverOfflineHint")}
              testID="home-nearby-offline"
            />
          ) : location.permission === "denied" ? (
            // Online but with no position, the nearby query is disabled --
            // which reads as `isPending`, so without this branch the list
            // shows loading skeletons for work that can never arrive.
            <EmptyState
              icon={(color) => <Package size={28} color={color} />}
              title={t("driverLocationNeeded")}
              testID="home-nearby-no-location"
            />
          ) : nearby.isPending ? (
            <KayaSkeletonList count={3} testID="home-nearby-loading" />
          ) : (nearby.data ?? []).length === 0 ? (
            <EmptyState
              icon={(color) => <Package size={28} color={color} />}
              title={t("commonEmpty")}
              testID="home-nearby-empty"
            />
          ) : (
            (nearby.data ?? []).map((order, index) => (
              <RequestRow
                key={order.id}
                order={order}
                currency={currency}
                index={index}
                onPress={() => router.push(`/propose/${order.id}`)}
              />
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function RequestRow({
  order,
  currency,
  index,
  onPress,
}: {
  order: NearbyOrder;
  currency: Currency;
  index: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  return (
    <KayaPressable onPress={onPress} testID={`home-request-${index}`}>
      <KayaCard>
        <View style={styles.requestRow}>
          <View style={styles.requestIcon}>
            <Package size={18} color={colors.primary} />
          </View>
          <View style={styles.requestText}>
            <Text style={typography.bodyStrong} numberOfLines={1}>
              {order.deliveryAddress}
            </Text>
            <Text style={typography.caption} numberOfLines={1}>
              {t("driverKmAway", { km: order.distanceToPickupKm.toFixed(1) })} ·{" "}
              {order.pickupAddress}
            </Text>
          </View>
          {order.minPriceSuggested === null ? null : (
            <Text style={typography.bodyStrong}>
              {formatMoney(order.minPriceSuggested, currency)}
            </Text>
          )}
        </View>
      </KayaCard>
    </KayaPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  floating: { paddingHorizontal: spacing.lg, gap: spacing.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statusText: { flex: 1 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  earningsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  onPrimary: { color: colors.surface },
  link: { color: colors.primary, marginTop: spacing.xs },

  // The sheet is pinned to the bottom and capped at just under half the
  // screen: the map above it has to keep telling the driver where the work is.
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "48%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    ...shadows.sheet,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  activeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  activeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  activeText: { flex: 1 },
  requestRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  requestIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  requestText: { flex: 1 },
});

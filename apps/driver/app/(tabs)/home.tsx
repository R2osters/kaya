import { formatMoney, userCurrency, type Currency, type NearbyOrder } from "@kaya/core";
import {
  EmptyState,
  KayaAnimatedListItem,
  KayaAvatar,
  KayaCard,
  KayaCommissionGauge,
  KayaCountBadge,
  KayaDraggableSheet,
  KayaPressable,
  KayaSkeletonList,
  MapView,
  colors,
  pickupMarker,
  spacing,
  springs,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Bell, Navigation, Package } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, {
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDriverLocation } from "../../src/location/useDriverLocation";
import { useCountryConfig } from "../../src/queries/countryConfig";
import { useActiveDelivery } from "../../src/queries/deliveries";
import { useDriverStats, useSetOnline } from "../../src/queries/driver";
import { useNotifications } from "../../src/queries/inbox";
import { useNearbyOrders } from "../../src/queries/nearby";
import { useAuthStore } from "../../src/state/authStore";

/**
 * Delivery ordinals at which the commission steps down. Constants on the
 * backend too (`CommissionService.rateFor`) and stated in BLUEPRINT.md; the
 * *rates* that go with them are per-country and come from the tariff card.
 */
const TIER_BOUNDARIES = [1, 7, 11, 15];

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
  // The ladder's own thresholds are the project rule (BLUEPRINT: the 7th run
  // of the day steps down); the rates beside them belong to the driver's
  // country and are read, never assumed.
  const config = useCountryConfig();
  const tiers = config.data?.commissionTiers.map((rate, index) => ({
    from: TIER_BOUNDARIES[index] ?? 1,
    rate,
  }));
  // The count the bell wears. Pushes invalidate this key as they arrive
  // (see usePushMessages), so the badge moves without a refresh.
  const unread = useNotifications().data?.unread ?? 0;

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
          // Opens on the driver own country city rather than Accra for
          // everyone -- see MapViewProps.countryCode.
          countryCode={user?.countryCode}
          testID="home-map"
        />
      </View>

      <View style={[styles.floating, { paddingTop: insets.top + spacing.md }]}>
        {/* Profile row: the driver's own identity and their inbox, above the
            work. Kept off the status card so that card can be a single solid
            statement rather than a container for unrelated controls. */}
        <View style={styles.profileRow}>
          <KayaAvatar name={user?.fullName ?? ""} photoUrl={user?.profilePhoto ?? undefined} size={40} />
          {/* Nothing between the avatar and the bell: floating text over a map
              is unreadable whatever colour it is given, and the label that sat
              here only repeated the earnings card two rows below. */}
          <View style={styles.profileText} />
          <KayaPressable
            onPress={() => router.push("/notifications")}
            style={styles.bell}
            testID="home-notifications"
          >
            <Bell size={20} color={colors.ink} />
            <KayaCountBadge count={unread} testID="home-notifications-badge" />
          </KayaPressable>
        </View>

        {/* The only dark solid in either app, and it earns it: this is the one
            card a driver reads at a glance in direct sunlight, from a bike
            cradle, while deciding whether they are working. Offline it drops
            back to a plain surface -- the weight belongs to the state that
            costs money, not to the control. */}
        <KayaCard
          color={online ? colors.ink : colors.surface}
          border={!online}
          testID="home-status-card"
        >
          <View style={styles.statusRow}>
            <StatusDot online={online} />
            {/* Keyed on the state so both lines arrive rather than being
                swapped underneath the driver's thumb. Going online is the one
                decision on this screen that changes what the app does, and it
                is taken while looking at the switch, not at the words. */}
            <KayaAnimatedListItem key={String(online)} style={styles.statusText}>
              <Text style={[typography.sectionTitle, online && styles.onDark]}>
                {online ? t("driverOnline") : t("driverOffline")}
              </Text>
              <Text style={[typography.caption, online && styles.onDarkSecondary]} numberOfLines={1}>
                {online ? t("driverNearbyRequests") : t("driverOfflineHint")}
              </Text>
            </KayaAnimatedListItem>

            {setOnline.isPending ? (
              <ActivityIndicator color={online ? colors.surface : colors.primary} testID="home-online-pending" />
            ) : (
              <Switch
                value={online}
                onValueChange={toggle}
                trackColor={{ true: colors.success, false: colors.border }}
                testID="home-online-toggle"
              />
            )}
          </View>
        </KayaCard>

        <KayaCard testID="home-today-earnings">
          <Text style={typography.overline}>{t("driverTodayEarnings")}</Text>
          <Text style={typography.priceLarge} testID="home-today-amount">
            {stats.data === undefined
              ? "—"
              : formatMoney(stats.data.todayEarnings, stats.data.currency)}
          </Text>

          {/* The commission ladder, felt rather than tabulated: the segment
              the driver is in is the one partly full, and the next one is
              cheaper. Rates come from the country's own row, never constants. */}
          {tiers !== undefined && (
            <KayaCommissionGauge
              tiers={tiers}
              coursesDone={stats.data?.dailyDeliveries ?? 0}
              accessibilityLabel={t("driverCommissionTiers")}
              style={styles.gauge}
              testID="home-commission"
            />
          )}
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

      {/* Pullable rather than fixed at 48%: a driver with six nearby jobs was
          scrolling that list through a window chosen once for everyone, while
          the map underneath showed them nothing they were not already looking
          at. Now they choose, per moment, how much of each they want. */}
      <KayaDraggableSheet
        handleAccessibilityLabel={t("driverNearbyRequests")}
        testID="home-sheet"
      >

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
      </KayaDraggableSheet>
    </View>
  );
}

/**
 * The one thing on this screen that says, at a glance and without being read,
 * whether the app is working for the driver right now.
 *
 * The switch already carries the state, but a switch is a control: it says
 * what you may do, not what is true. Between runs a driver looks at this
 * screen for a second at a time, and the difference between earning and not
 * earning should survive that second. The colour springs rather than cuts,
 * because the change is the information.
 */
function StatusDot({ online }: { online: boolean }) {
  const progress = useSharedValue(online ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(online ? 1 : 0, {
      ...springs.settle,
      reduceMotion: ReduceMotion.System,
    });
  }, [online, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.inkTertiary, colors.success],
    ),
    transform: [{ scale: 1 + progress.value * 0.15 }],
  }));

  return <Animated.View style={[styles.statusDot, animatedStyle]} />;
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
    // Work arrives here without being asked for: a client publishes an order
    // inside the driver's radius and a row appears. The entrance is what tells
    // a driver glancing at the sheet that the list grew rather than that they
    // misread it a second ago.
    <KayaAnimatedListItem index={index}>
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
    </KayaAnimatedListItem>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  floating: { paddingHorizontal: spacing.lg, gap: spacing.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statusText: { flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  profileText: { flex: 1 },
  // Text sitting on the ink status card.
  onDark: { color: colors.surface },
  onDarkSecondary: { color: colors.border },
  gauge: { marginTop: spacing.md },
  link: { color: colors.primary, marginTop: spacing.xs },

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

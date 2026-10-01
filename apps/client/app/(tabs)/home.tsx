import { type Order } from "@kaya/core";
import {
  EmptyState,
  KayaAnimatedListItem,
  KayaButton,
  KayaCard,
  KayaCountBadge,
  KayaGlassBar,
  KayaPressable,
  KayaScrim,
  KayaSkeletonList,
  MapView,
  colors,
  radii,
  spacing,
  typography,
  useDeviceLocation,
  vehicleMarker,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Bell, MapPin, Package, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "../../src/queries/inbox";
import { useNearbyDrivers } from "../../src/queries/nearbyDrivers";
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
  const countryCode = useAuthStore((s) => s.user?.countryCode);

  // Asked for on mount here, unlike on the driver's side: this screen's whole
  // job is to show the user where they are and who is around them, so the
  // prompt arrives with its reason already on screen behind it. A refusal
  // costs the pins and the centring, nothing else -- the search pill below
  // still works, and addresses are still typed by hand.
  const location = useDeviceLocation({ requestOnMount: true });
  const drivers = useNearbyDrivers(location.position);
  // The count the bell wears. Pushes invalidate this key as they arrive
  // (see usePushMessages), so the badge moves without a refresh.
  const unread = useNotifications().data?.unread ?? 0;

  const past = orders.data === undefined ? [] : splitHistory(orders.data.data).past;
  const recent = past.slice(0, RECENT_LIMIT);

  return (
    <View style={styles.screen} testID="home-screen">
      {/* The map is the screen, not a banner on top of it: full-bleed under
          everything else. It is centred on the user, shows the drivers
          actually working around them, and falls back to their own country's
          city rather than to Accra for everyone -- see MapViewProps.countryCode. */}
      <View style={StyleSheet.absoluteFill}>
        <MapView
          center={location.position ?? undefined}
          markers={(drivers.data ?? []).map((point) => vehicleMarker(point))}
          showUserLocation={location.permission === "granted"}
          countryCode={countryCode}
          testID="home-map"
        />
      </View>

      {/* Floating text never trusts its backdrop -- see KayaScrim. */}
      <KayaScrim edge="top" height={140} />

      {/* Glass, and one of only three places in the design that gets it: a
          translucent bar says "something live is underneath this", and it
          stops saying anything once every panel is translucent. */}
      <View style={[styles.searchRow, { top: insets.top + spacing.md }]}>
        <KayaGlassBar style={styles.searchBar} testID="home-search-glass">
          <KayaPressable
            onPress={() => router.push("/create-order")}
            style={styles.search}
            testID="home-search"
          >
            <Search size={20} color={colors.inkSecondary} />
            <Text style={[typography.body, styles.searchLabel]} numberOfLines={1}>
              {t("homeSearchHint")}
            </Text>
          </KayaPressable>
        </KayaGlassBar>

        <KayaGlassBar radius={radii.pill} style={styles.bellGlass}>
          <KayaPressable
            onPress={() => router.push("/notifications")}
            style={styles.bell}
            testID="home-notifications"
          >
            <Bell size={20} color={colors.ink} />
            <KayaCountBadge count={unread} testID="home-notifications-badge" />
          </KayaPressable>
        </KayaGlassBar>
      </View>

      {/* The action card sits on the map rather than below it, anchored where
          the thumb already is. Everything the screen asks of the user is in
          this one surface; the map behind it is context, not a control. */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <KayaCard testID="home-action-card">
          {/* Both branches of this used to render the same string -- the
              first name was read from the session, interpolated into nothing,
              and the greeting never personalised for anyone. The name is the
              one piece of warmth on an otherwise map-shaped screen; it stays
              optional because the session is still restoring on first frames. */}
          <Text style={typography.sectionTitle} testID="home-screen-title">
            {firstName === undefined
              ? t("homeWhatMoving")
              : t("homeWhatMovingNamed", { name: firstName })}
          </Text>

          <Text style={[typography.overline, styles.recentLabel]}>{t("homeRecentDropoffs")}</Text>

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

          <View style={styles.cta}>
            <KayaButton
              label={t("homeNewDelivery")}
              onPress={() => router.push("/create-order")}
              expand
              testID="home-new-order"
            />
          </View>
        </KayaCard>
      </ScrollView>
    </View>
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
    // A row inside the action card, not a card of its own: nesting a card in a
    // card gives two shadows and two borders for one piece of information, and
    // the recents are a shortcut list, not four separate objects.
    <KayaAnimatedListItem index={index}>
      <KayaPressable onPress={onPress} style={styles.recentRow} testID={`home-recent-${index}`}>
        <View style={styles.recentIcon}>
          <MapPin size={16} color={colors.primary} />
        </View>
        <View style={styles.recentText}>
          <Text style={typography.body} numberOfLines={1}>
            {order.deliveryAddress}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {order.pickupAddress}
          </Text>
        </View>
      </KayaPressable>
    </KayaAnimatedListItem>
  );
}

/** The design's screen margin. Everything floating over the map respects it. */
const SCREEN_MARGIN = spacing.lg;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  searchRow: {
    position: "absolute",
    left: SCREEN_MARGIN,
    right: SCREEN_MARGIN,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchBar: { flex: 1 },
  search: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  searchLabel: { flex: 1, color: colors.inkSecondary },
  bellGlass: { width: 52, height: 52 },
  bell: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Anchored to the bottom half so the card lands under the thumb and the map
  // keeps the top of the screen. Scrollable rather than fixed: a long recents
  // list must not push the primary action off a small screen.
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "62%",
  },
  sheetContent: { paddingHorizontal: SCREEN_MARGIN },
  recentLabel: { marginTop: spacing.lg },
  cta: { marginTop: spacing.lg },

  // 44 is the design's minimum target, and these rows are the one place on
  // this screen where a list item is also a shortcut.
  recentRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
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

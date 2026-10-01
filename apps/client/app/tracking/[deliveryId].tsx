import { liveTimelineStep, timelineStep, toApiFailure, type Delivery } from "@kaya/core";
import {
  KayaAnimatedListItem,
  KayaButton,
  KayaDraggableSheet,
  KayaGlassBar,
  KayaScreenHeader,
  KayaScrim,
  KayaSkeleton,
  KayaTimeline,
  MapView,
  colors,
  dropoffMarker,
  pickupMarker,
  radii,
  spacing,
  typography,
  useSmoothedPoint,
  vehicleMarker,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGoBack } from "../../src/navigation/useGoBack";
import {
  useDelivery,
  useDeliveryLiveStatus,
  useDriverLocation,
} from "../../src/queries/deliveries";

const STEP_LABELS = ["trackEnRoute", "trackPickedUp", "trackInTransit", "trackDelivered"] as const;

/**
 * Live tracking, phase 2A. Ported from
 * legacy/flutter/client/lib/features/tracking/tracking_screen.dart.
 *
 * Reads three cache entries, only one of which is fetched:
 *
 *  - the `Delivery` itself, over REST;
 *  - the driver's position, written by the realtime bridge on every
 *    `location:driver` tick and never refetched -- a request per tick would be
 *    unaffordable at ~5s intervals on mobile data;
 *  - the last `delivery:status` event, held apart from the delivery because
 *    the same channel carries OrderStatus values that would corrupt or be
 *    coerced away by the delivery's own enum.
 *
 * The timeline prefers the live status and falls back to the delivery. That is
 * the difference between advancing when the driver acts and advancing once the
 * invalidation has come back.
 */
export default function TrackingScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const insets = useSafeAreaInsets();

  const delivery = useDelivery(deliveryId);
  const liveStatus = useDeliveryLiveStatus(deliveryId);
  const driverLocation = useDriverLocation(delivery.data?.livreurId ?? null);
  // The position arrives over the socket roughly every five seconds, and the
  // marker was rendered straight from it: still, teleport a block, still. On
  // the one screen whose job is "where are they now", a teleport reads as the
  // app having lost the driver and found them somewhere else.
  const driverPoint = useSmoothedPoint(driverLocation);

  const step = currentStep(delivery.data, liveStatus?.status);

  const error =
    delivery.error === null || delivery.error === undefined
      ? null
      : toApiFailure(delivery.error).message;

  return (
    <View style={styles.screen} testID="tracking-screen">
      {/* Map first and full-bleed: on this screen the map *is* the answer to
          the question the user opened it with. Everything else floats. */}
      <View style={StyleSheet.absoluteFill}>
        {delivery.isPending ? (
          <KayaSkeleton height={220} testID="tracking-map-loading" />
        ) : (
          <MapView markers={markersFor(delivery.data, driverPoint)} testID="tracking-map" />
        )}
      </View>

      <KayaScrim edge="top" height={140} />

      <View style={[styles.header, { top: insets.top + spacing.sm }]}>
        <KayaScreenHeader title={t("trackTitle")} onBack={goBack} testID="tracking-screen" />
      </View>

      {/* Glass, second of the design's three placements: the step reads over a
          moving map and has to stay legible against whatever is under it. */}
      <KayaGlassBar
        radius={radii.pill}
        style={[styles.etaPill, { top: insets.top + spacing.xxxl + spacing.lg }]}
        testID="tracking-eta"
      >
        <KayaAnimatedListItem key={step} style={styles.etaInner}>
          <Text style={styles.etaLabel} testID="tracking-step-label">
            {t(STEP_LABELS[step])}
          </Text>
        </KayaAnimatedListItem>
      </KayaGlassBar>

      <KayaDraggableSheet
        collapsedRatio={0.42}
        expandedRatio={0.8}
        handleAccessibilityLabel={t("trackTitle")}
        testID="tracking-sheet"
      >
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          {error !== null && (
            <Text style={styles.error} testID="tracking-error">
              {error}
            </Text>
          )}

          <View testID="tracking-timeline">
            <KayaTimeline
              count={STEP_LABELS.length}
              step={step}
              accessibilityLabel={t("trackTitle")}
              testID="tracking"
            />
          </View>

          {/* The two things a client does from here. Neither was reachable
              from any screen before -- chat and rating existed only behind the
              dev route explorer, which meant the journey dead-ended here. */}
          <KayaButton
            label={t("trackChat")}
            variant="secondary"
            onPress={() => router.push(`/chat/${deliveryId}`)}
            expand
            testID="tracking-chat"
          />

          {step === 3 && (
            <KayaButton
              label={t("trackRate")}
              onPress={() => router.push(`/rating/${deliveryId}`)}
              expand
              testID="tracking-rate"
            />
          )}
        </ScrollView>
      </KayaDraggableSheet>
    </View>
  );
}

/**
 * The live event wins when it says something about position; otherwise the
 * cached delivery does. Exported for the tests, which is where the interesting
 * combinations live.
 */
export function currentStep(
  delivery: Delivery | undefined,
  liveStatus: string | undefined,
): 0 | 1 | 2 | 3 {
  if (liveStatus !== undefined) {
    const live = liveTimelineStep(liveStatus);
    if (live !== null) return live;
  }
  return delivery === undefined ? 0 : timelineStep(delivery);
}

function markersFor(
  delivery: Delivery | undefined,
  driverLocation: { lat: number; lng: number } | undefined,
) {
  const order = delivery?.order;
  const markers = [];

  if (order !== null && order !== undefined) {
    // orderSchema folds the flat lat/lng pairs into GeoPoints named
    // `pickup` and `dropoff`; the wire's pickupLat/pickupLng do not survive it.
    markers.push(pickupMarker(order.pickup));
    markers.push(dropoffMarker(order.dropoff));
  }
  if (driverLocation !== undefined) {
    markers.push(vehicleMarker({ lat: driverLocation.lat, lng: driverLocation.lng }));
  }

  return markers;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { position: "absolute", left: spacing.lg, right: spacing.lg },
  etaPill: { position: "absolute", left: spacing.lg, alignSelf: "flex-start" },
  etaInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  // The current step is the one live fact on this screen, so it takes the
  // primary tone rather than sitting in the same ink as everything around it.
  etaLabel: { ...typography.bodyStrong, color: colors.primary },
  sheetContent: { gap: spacing.lg, paddingBottom: spacing.lg },
  error: { ...typography.caption, color: colors.danger },
});

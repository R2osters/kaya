import { liveTimelineStep, timelineStep, toApiFailure, type Delivery } from "@kaya/core";
import {
  KayaCard,
  KayaSkeleton,
  MapView,
  colors,
  dropoffMarker,
  pickupMarker,
  spacing,
  typography,
  vehicleMarker,
} from "@kaya/ui";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();

  const delivery = useDelivery(deliveryId);
  const liveStatus = useDeliveryLiveStatus(deliveryId);
  const driverLocation = useDriverLocation(delivery.data?.livreurId ?? null);

  const step = currentStep(delivery.data, liveStatus?.status);

  const error =
    delivery.error === null || delivery.error === undefined
      ? null
      : toApiFailure(delivery.error).message;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="tracking-screen"
    >
      <Text style={typography.screenTitle} testID="tracking-screen-title">
        {t("trackTitle")}
      </Text>

      {error !== null && (
        <Text style={styles.error} testID="tracking-error">
          {error}
        </Text>
      )}

      <View style={styles.map}>
        {delivery.isPending ? (
          <KayaSkeleton height={220} testID="tracking-map-loading" />
        ) : (
          <MapView
            markers={markersFor(delivery.data, driverLocation)}
            testID="tracking-map"
          />
        )}
      </View>

      <KayaCard testID="tracking-timeline">
        <Text style={typography.bodyStrong} testID="tracking-step-label">
          {t(STEP_LABELS[step])}
        </Text>
        <View style={styles.steps}>
          {STEP_LABELS.map((label, index) => (
            <View
              key={label}
              style={[styles.step, index <= step && styles.stepDone]}
              testID={`tracking-step-${index}${index <= step ? "-done" : ""}`}
            />
          ))}
        </View>
      </KayaCard>
    </ScrollView>
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
  content: { padding: spacing.xxl, gap: spacing.lg },
  map: { height: 240, borderRadius: 20, overflow: "hidden" },
  steps: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  step: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderSoft },
  stepDone: { backgroundColor: colors.primary },
  error: { ...typography.caption, color: colors.danger },
});

import { toApiFailure, type OrderStatus } from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaSkeletonCard,
  MapView,
  colors,
  dropoffMarker,
  pickupMarker,
  radii,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, CheckCircle2, Navigation, Truck } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { runStepFor, type RunAction } from "../../src/delivery/runStep";
import { useDeliveryPhoto } from "../../src/delivery/useDeliveryPhoto";
import {
  useConfirmDelivery,
  useDelivery,
  useDeliveryLiveStatus,
  usePickupDelivery,
  useStartDelivery,
  useTransitDelivery,
} from "../../src/queries/deliveries";

const STEP_LABELS = ["trackEnRoute", "driverTakePickupPhoto", "trackInTransit", "trackDelivered"] as const;

/**
 * The run itself, phase 3. Ported from
 * legacy/flutter/driver/lib/features/delivery/active_delivery_screen.dart.
 *
 * One screen, one button, four times: start -> pickup -> transit -> delivered.
 * A driver holding a package on a motorbike is not browsing; the action bar is
 * the whole interface, and everything above it exists to tell them where they
 * are going and who to call when the address is wrong.
 *
 * Which of the four the button is comes from `runStepFor`, on the *order's*
 * status -- see that module for why the delivery's own status cannot answer
 * it. The live `delivery:status` event is preferred over the fetched delivery
 * so the bar advances the moment the transition lands rather than after the
 * refetch, which on a bad connection is the difference between a driver
 * tapping once and tapping three times.
 */
export default function ActiveDeliveryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const id = deliveryId ?? "";

  const delivery = useDelivery(id);
  const liveStatus = useDeliveryLiveStatus(id);
  const photo = useDeliveryPhoto();
  const [photoSkipped, setPhotoSkipped] = useState(false);

  const start = useStartDelivery(id);
  const pickup = usePickupDelivery(id);
  const transit = useTransitDelivery(id);
  const confirm = useConfirmDelivery(id);

  if (delivery.isPending) {
    return (
      <View style={styles.screen} testID="delivery-screen">
        <KayaSkeletonCard testID="delivery-loading" />
      </View>
    );
  }

  const order = delivery.data?.order ?? null;
  // The live event's status string is an OrderStatus in this channel; it is
  // typed as a bare string upstream precisely because the same channel also
  // carries delivery vocabulary, and runStepFor treats anything it does not
  // recognise as "nothing left to do".
  const status = (liveStatus?.status as OrderStatus | undefined) ?? order?.status;
  const step = runStepFor(status);

  const busy =
    start.isPending ||
    pickup.isPending ||
    transit.isPending ||
    confirm.isPending ||
    photo.uploading;

  const failure = start.error ?? pickup.error ?? transit.error ?? confirm.error;
  const error = failure === null || failure === undefined ? null : toApiFailure(failure).message;

  const run = (action: RunAction) => {
    switch (action) {
      case "start":
        start.mutate();
        return;
      case "pickup":
        // The photo is evidence, not a gate. A refused camera or a failed
        // upload resolves null and the pickup posts without it, because the
        // alternative is a driver stranded at a doorstep.
        void photo.capture().then((key) => {
          setPhotoSkipped(key === null);
          pickup.mutate(key ?? undefined);
        });
        return;
      case "transit":
        transit.mutate();
        return;
      case "deliver":
        confirm.mutate(undefined, {
          // Rating is the last thing that happens on a run, and it happens
          // once: replace rather than push so back does not return to a
          // finished delivery whose button can only 400.
          onSuccess: () => router.replace(`/rating/${id}`),
        });
        return;
      case "done":
    }
  };

  return (
    <View style={styles.screen} testID="delivery-screen">
      <View style={styles.map}>
        <MapView
          markers={[
            ...(order === null ? [] : [pickupMarker(order.pickup), dropoffMarker(order.dropoff)]),
          ]}
          showUserLocation
          testID="delivery-map"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.screenTitle} testID="delivery-screen-title">
          {t("driverActiveDelivery")}
        </Text>

        <View style={styles.timeline} testID="delivery-timeline">
          {STEP_LABELS.map((label, index) => (
            <View
              key={label}
              style={[styles.timelineSegment, index <= step.index && styles.timelineSegmentDone]}
            />
          ))}
        </View>
        <Text style={typography.caption} testID="delivery-step-label">
          {t(STEP_LABELS[step.index])}
        </Text>

        <KayaCard testID="delivery-route">
          <RouteLeg
            label={t("orderPickup")}
            value={order?.pickupAddress ?? "—"}
            tint={colors.success}
          />
          <View style={styles.legSpacer} />
          <RouteLeg
            label={t("orderDropoff")}
            value={order?.deliveryAddress ?? "—"}
            tint={colors.primary}
          />
        </KayaCard>

        <KayaButton
          label={t("actionChat")}
          variant="secondary"
          onPress={() => router.push(`/chat/${id}`)}
          expand
          testID="delivery-chat"
        />

        {photoSkipped && (
          <Text style={typography.caption} testID="delivery-photo-skipped">
            {t("driverPhotoSkipped")}
          </Text>
        )}

        {error !== null && (
          <Text style={styles.error} testID="delivery-error">
            {error}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <KayaButton
          label={t(step.labelKey)}
          // Function form: the button hands back its own foreground colour,
          // which is what keeps the icon legible on a filled surface.
          icon={(color) => actionIcon(step.action, color)}
          onPress={() => run(step.action)}
          loading={busy}
          disabled={step.action === "done"}
          expand
          testID="delivery-action"
        />
      </View>
    </View>
  );
}

function actionIcon(action: RunAction, color: string) {
  const size = 20;
  switch (action) {
    case "start":
      return <Navigation size={size} color={color} />;
    case "pickup":
      return <Camera size={size} color={color} />;
    case "transit":
      return <Truck size={size} color={color} />;
    default:
      return <CheckCircle2 size={size} color={color} />;
  }
}

function RouteLeg({ label, value, tint }: { label: string; value: string; tint: string }) {
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  map: { height: 240 },
  content: { padding: spacing.xxl, gap: spacing.md },
  timeline: { flexDirection: "row", gap: spacing.sm },
  timelineSegment: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  timelineSegmentDone: { backgroundColor: colors.primary },
  leg: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  legDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  legText: { flex: 1 },
  legSpacer: { height: spacing.md },
  footer: { padding: spacing.xxl, paddingTop: spacing.md },
  error: { ...typography.caption, color: colors.danger },
});

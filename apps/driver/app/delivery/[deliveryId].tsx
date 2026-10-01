import { toApiFailure, type OrderStatus } from "@kaya/core";
import {
  KayaAnimatedListItem,
  KayaButton,
  KayaCard,
  KayaSkeletonCard,
  KayaScreenHeader,
  KayaSlideToConfirm,
  KayaTimeline,
  MapView,
  colors,
  dropoffMarker,
  pickupMarker,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../../src/navigation/useGoBack";
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
  const goBack = useGoBack();
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
        <KayaScreenHeader title={t("driverActiveDelivery")} onBack={goBack} testID="delivery-screen" />

        <View testID="delivery-timeline">
          <KayaTimeline
            count={STEP_LABELS.length}
            step={step.index}
            accessibilityLabel={t("driverActiveDelivery")}
            testID="delivery"
          />
        </View>
        {/* Keyed on the step: the driver's own tap is what moves this, and the
            label arriving is the confirmation that the transition landed --
            which on a bad connection is the difference between tapping once
            and tapping three times. */}
        <KayaAnimatedListItem key={step.index}>
          <Text style={typography.caption} testID="delivery-step-label">
            {t(STEP_LABELS[step.index])}
          </Text>
        </KayaAnimatedListItem>

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
        {/* One action per step, always in the same place, always the same
            gesture -- only the label changes (En route → Récupéré → En transit
            → Livré). A slide rather than a tap because this phone spends its
            day in a jacket pocket or a bike cradle, and an accidental
            "delivered" releases an escrow on a package still strapped to the
            bike. A screen reader gets a plain activate action instead: the
            protection is against a pocket, not against a deliberate user. */}
        <KayaSlideToConfirm
          label={t(step.labelKey)}
          tone="success"
          onConfirm={() => run(step.action)}
          disabled={busy || step.action === "done"}
          accessibilityHint={t("actionSlideHint")}
          testID="delivery-action"
        />
      </View>
    </View>
  );
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
  content: { padding: spacing.lg, gap: spacing.md },
  leg: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  legDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  legText: { flex: 1 },
  legSpacer: { height: spacing.md },
  footer: { padding: spacing.xxl, paddingTop: spacing.md },
  error: { ...typography.caption, color: colors.danger },
});

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BottomSheetShell,
  EmptyState,
  KayaAvatar,
  KayaButton,
  KayaCard,
  KayaSkeleton,
  KayaSkeletonCard,
  KayaSkeletonList,
  KayaSkeletonListTile,
  KayaTextField,
  MapView,
  RatingStars,
  StatusPill,
  dropoffMarker,
  pickupMarker,
  spacing,
  typography,
  vehicleMarker,
} from "@kaya/ui";

/**
 * Design-system showcase, task 5 (phase 1C). One instance of every
 * @kaya/ui component -- all nine, the four skeletons, and the map fallback
 * -- so a human can compare this render against the reference screenshots in
 * `D:\prototype\Application de livraison ghanéenne\ref\`. This file builds
 * nothing new: every prop below is a value already used elsewhere in the
 * design system, composed here purely for visual inspection.
 *
 * This was `_showcase.tsx` until the route explorer shipped: the leading
 * underscore kept it out of expo-router's generated route tree, on the
 * reasoning that a developer-facing surface should not be reachable by an end
 * user. But `routeIndex.ts` then listed `/_showcase` under "design system",
 * which made it a dead link on every placeholder screen -- expo-router does
 * not route an underscore-prefixed file, so tapping it went nowhere and
 * nothing failed. Reachable wins: the showcase is the phase's visual
 * acceptance surface, a human has to be able to open it on a device, and it
 * disappears with the placeholders in phases 2 and 3 anyway. See
 * showcase.test.tsx for the automated half.
 *
 * Section headings below ("KayaButton", "RatingStars", ...) name the
 * component being demonstrated -- API identifiers, not product copy -- and
 * are the one deliberate exception to this task's "no hardcoded UI copy"
 * rule for that reason; every other string on this screen still comes from
 * @kaya/core's i18n resources.
 */
export default function ShowcaseScreen() {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fieldValue, setFieldValue] = useState("");

  const markers = [
    pickupMarker({ lat: 5.6037, lng: -0.187 }, "A"),
    dropoffMarker({ lat: 5.55, lng: -0.21 }, "B"),
    vehicleMarker({ lat: 5.58, lng: -0.2 }),
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} testID="showcase-screen">
      <Text style={typography.screenTitle}>{t("screenShowcase")}</Text>

      <Section title="KayaButton">
        <KayaButton label={t("actionContinue")} onPress={() => {}} testID="showcase-button-primary" />
        <KayaButton
          label={t("actionCancel")}
          variant="secondary"
          onPress={() => {}}
          testID="showcase-button-secondary"
        />
        <KayaButton label={t("actionRefuse")} variant="danger" onPress={() => {}} testID="showcase-button-danger" />
        <KayaButton label={t("commonLoading")} loading testID="showcase-button-loading" />
      </Section>

      {/*
        Verification item 1 (task 5's brief): the shadow and line-height
        translations. `KayaCard` carries `shadows.card`; its title below is
        styled `typography.cardTitle`, and this section's own heading is
        `typography.sectionTitle` -- both converted from Flutter's line-height
        multiplier to React Native's absolute lineHeight in phase 1B and never
        visually checked since. Compare this card against the reference
        screenshots' cards.
      */}
      <Section title="KayaCard">
        <KayaCard testID="showcase-card">
          <Text style={typography.cardTitle}>{t("orderPickup")}</Text>
          <Text style={typography.bodySecondary}>{t("homeSearchHint")}</Text>
        </KayaCard>
      </Section>

      <Section title="StatusPill">
        <View style={styles.row}>
          <StatusPill label={t("trackDelivered")} tone="success" testID="showcase-pill-success" />
          <StatusPill label={t("trackEnRoute")} tone="primary" testID="showcase-pill-primary" />
          <StatusPill label={t("invalidAmount")} tone="danger" testID="showcase-pill-danger" />
          <StatusPill label={t("profilePending")} tone="amber" testID="showcase-pill-amber" />
          <StatusPill label={t("profileApproved")} tone="neutral" testID="showcase-pill-neutral" />
        </View>
      </Section>

      {/*
        Verification items 2 and 3 (task 5's brief). Two rows, deliberately:
        - item 2, the half-star -- 4.3 lands in the half-fill branch
          (kindAt's `value - i >= 0.25` rule), which layers an outline glyph
          under a half-fill glyph since lucide ships no single half-star icon.
          A visible seam between the two layers is what a human needs to look
          for on the last star of the first row.
        - item 3, the testID collision -- both rows render on this one
          screen. Before the fix in @kaya/ui/src/components/RatingStars.tsx,
          every star on both rows was testID "star-0".."star-4" regardless of
          which row it belonged to, so `getByTestId("star-0")` was ambiguous
          between them. Each row's stars are now scoped to the row's own
          testID ("showcase-rating-one-star-0" vs "showcase-rating-two-star-0"),
          which showcase.test.tsx asserts directly.
      */}
      <Section title="RatingStars">
        <RatingStars value={4.3} testID="showcase-rating-one" />
        <RatingStars value={2.5} testID="showcase-rating-two" />
      </Section>

      <Section title="KayaAvatar">
        <View style={styles.row}>
          <KayaAvatar name="Ama Owusu" testID="showcase-avatar-initials" />
          <KayaAvatar name="Kwame Boateng" ring testID="showcase-avatar-ring" />
        </View>
      </Section>

      <Section title="KayaTextField">
        <KayaTextField
          label={t("authPhone")}
          value={fieldValue}
          onChangeText={setFieldValue}
          testID="showcase-textfield"
        />
      </Section>

      <Section title="EmptyState">
        <EmptyState
          icon={(color) => <View style={[styles.emptyIcon, { borderColor: color }]} />}
          title={t("inboxEmpty")}
          message={t("notifEmpty")}
          actionLabel={t("actionRetry")}
          onAction={() => {}}
          testID="showcase-empty-state"
        />
      </Section>

      <Section title="BottomSheetShell">
        <KayaButton label={t("actionSend")} onPress={() => setSheetOpen(true)} testID="showcase-sheet-trigger" />
        <BottomSheetShell
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={t("payReceipt")}
          dismissAccessibilityLabel={t("actionClose")}
          testID="showcase-sheet"
        >
          <Text style={typography.body}>{t("payEscrowNote")}</Text>
        </BottomSheetShell>
      </Section>

      <Section title="Skeletons (KayaSkeleton, KayaSkeletonListTile, KayaSkeletonList, KayaSkeletonCard)">
        <KayaSkeleton width={160} testID="showcase-skeleton" />
        <KayaSkeletonListTile testID="showcase-skeleton-list-tile" />
        <KayaSkeletonList count={2} testID="showcase-skeleton-list" />
        <KayaSkeletonCard testID="showcase-skeleton-card" />
      </Section>

      <Section title="MapView (MapLibre + OpenStreetMap, registered at startup)">
        <View style={styles.map}>
          <MapView markers={markers} testID="showcase-map" />
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={typography.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.xxl },
  section: { gap: spacing.md },
  sectionBody: { gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  map: { height: 220, borderRadius: 16, overflow: "hidden" },
  // borderColor is deliberately not set here -- it is always supplied at the
  // call site from EmptyState's `icon(color)` argument (colors.inkTertiary),
  // matching the shared icon convention used by KayaButton/StatusPill/etc.
  emptyIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
});

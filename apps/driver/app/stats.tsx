import { formatMoney } from "@kaya/core";
import { KayaCard, KayaSkeletonCard, colors, radii, spacing, typography } from "@kaya/ui";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useDriverStats } from "../src/queries/driver";

/** The delivery ordinals at which commission steps down, per the project rules. */
const TIER_BOUNDARIES = [1, 7, 11, 15] as const;

/**
 * Stats, phase 3. Ported from
 * legacy/flutter/driver/lib/features/stats/stats_screen.dart.
 *
 * The commission ladder is the screen's reason to exist. A driver who knows
 * the 7th run of the day is commissioned at 15 % instead of 20 % plans their
 * afternoon around it; one who does not is being charged a rate they cannot
 * predict. Both the current and the next rate are computed by the backend
 * (`/driver/stats`) against the same tier table the ledger uses, so this
 * cannot drift from what is actually taken.
 */
export default function StatsScreen() {
  const { t } = useTranslation();
  const stats = useDriverStats();

  if (stats.isPending) {
    return (
      <View style={styles.screen} testID="stats-screen">
        <KayaSkeletonCard testID="stats-loading" />
      </View>
    );
  }

  const data = stats.data;
  const currency = data?.currency ?? "GHS";
  const done = data?.dailyDeliveries ?? 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="stats-screen"
    >
      <Text style={typography.screenTitle} testID="stats-screen-title">
        {t("driverStats")}
      </Text>

      <View style={styles.row}>
        <Tile
          label={t("driverTodayEarnings")}
          value={data === undefined ? "—" : formatMoney(data.todayEarnings, currency)}
          testID="stats-today"
        />
        <Tile
          label={t("driverTotalDeliveries")}
          value={data === undefined ? "—" : String(data.totalDeliveries)}
          testID="stats-total"
        />
      </View>

      <KayaCard testID="stats-tiers">
        <Text style={typography.sectionTitle}>{t("driverCommissionTiers")}</Text>
        <Text style={typography.caption}>
          {t("driverTierLine", {
            number: done + 1,
            pct: Math.round((data?.nextCommissionRate ?? 0) * 100),
          })}
        </Text>

        <View style={styles.ladder}>
          {TIER_BOUNDARIES.map((from, index) => {
            const to = TIER_BOUNDARIES[index + 1];
            const active = done + 1 >= from && (to === undefined || done + 1 < to);
            return (
              <View
                key={from}
                style={[styles.rung, active && styles.rungActive]}
                testID={`stats-tier-${from}`}
              >
                <Text style={[typography.caption, active && styles.rungActiveLabel]}>
                  {to === undefined ? `${from}+` : `${from}–${to - 1}`}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={typography.caption} testID="stats-next-tier">
          {data?.nextTierThreshold === null || data?.nextTierThreshold === undefined
            ? t("driverBestTier")
            : t("driverNextTier", { number: data.nextTierThreshold })}
        </Text>
      </KayaCard>
    </ScrollView>
  );
}

function Tile({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.tile}>
      <KayaCard testID={testID}>
        <Text style={typography.caption} numberOfLines={1}>
          {label}
        </Text>
        <Text style={typography.price}>{value}</Text>
      </KayaCard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  tile: { flex: 1 },
  ladder: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md },
  rung: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.background,
  },
  rungActive: { backgroundColor: colors.primaryTint },
  rungActiveLabel: { color: colors.primary, fontWeight: "700" },
});

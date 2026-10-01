import { formatMoney } from "@kaya/core";
import {
  KayaAnimatedListItem,
  KayaCommissionGauge,
  KayaScreenHeader,
  KayaCard,
  KayaSkeletonCard,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../src/navigation/useGoBack";
import { useCountryConfig } from "../src/queries/countryConfig";
import { useDriverStats } from "../src/queries/driver";

/**
 * The delivery ordinals at which commission steps down. These four numbers are
 * the rule itself (BLUEPRINT.md: the 7th run of the day is charged at tier 2),
 * and they are constants on the backend too — `CommissionService.rateFor`.
 *
 * The *rates* are a different matter and are deliberately not here: they live
 * in `country_configs`, one row per country, and are read through
 * `useCountryConfig` below. A ladder that drew "20 / 15 / 12 / 9" from
 * constants would keep saying Ghana's numbers to a driver in Togo the day
 * those rows diverge — which is the exact drift the read-only
 * `GET /country-configs/:code` endpoint was added to prevent.
 */
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
  const goBack = useGoBack();
  const stats = useDriverStats();
  const config = useCountryConfig();

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
  // Undefined until the tariff card arrives; the ladder then draws its ranges
  // without percentages rather than inventing them. `commissionTiers` is a
  // 4-tuple in ladder order -- @kaya/core's countryConfig model already folds
  // the wire's commissionTier1..4 columns into it.
  const rates = config.data?.commissionTiers;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="stats-screen"
    >
      <KayaScreenHeader title={t("driverStats")} onBack={goBack} testID="stats-screen" />

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

        {/* The gauge itself is @kaya/ui's, shared with the driver's home and
            earnings tabs. This screen drew its own row of rungs before, which
            is exactly the duplication the package exists to prevent: three
            renderings of one rule, free to drift apart. */}
        {rates !== undefined && (
          <KayaCommissionGauge
            tiers={TIER_BOUNDARIES.map((from, index) => ({ from, rate: rates[index] ?? 0 }))}
            coursesDone={done}
            accessibilityLabel={t("driverCommissionTiers")}
            style={styles.ladder}
            testID="stats-gauge"
          />
        )}

        {/* The ladder read as four ranges and no percentages before -- a scale
            with no units. The rates come from the country's own tariff row. */}
        <View style={styles.rungLabels}>
          {TIER_BOUNDARIES.map((from, index) => {
            const to = TIER_BOUNDARIES[index + 1];
            const active = done + 1 >= from && (to === undefined || done + 1 < to);
            const rate = rates?.[index];
            return (
              <KayaAnimatedListItem key={from} index={index} style={styles.rungWrap}>
                <View style={styles.rung} testID={`stats-tier-${from}`}>
                  <Text style={[typography.caption, active && styles.rungActiveLabel]}>
                    {to === undefined ? `${from}+` : `${from}–${to - 1}`}
                  </Text>
                  {rate !== undefined && (
                    <Text
                      style={[
                        active ? typography.bodyStrong : typography.caption,
                        active && styles.rungActiveLabel,
                      ]}
                      testID={`stats-tier-${from}-rate`}
                    >
                      {t("driverTierRate", { pct: Math.round(rate * 100) })}
                    </Text>
                  )}
                </View>
              </KayaAnimatedListItem>
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
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  tile: { flex: 1 },
  ladder: { marginTop: spacing.md },
  // The labels sit under the gauge's own segments, one per tier, so the
  // widths line up with the bars they name.
  rungLabels: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  rungWrap: { flex: 1 },
  rung: { alignItems: "center", paddingTop: spacing.xs },
  rungActiveLabel: { color: colors.primary },
});

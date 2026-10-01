import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { colors, radii, spacing } from "../theme";
import { STAGGER_MS, progress } from "../theme/motion";

export interface CommissionTier {
  /** Delivery ordinal at which this tier starts: 1, 7, 11, 15. */
  from: number;
  /** Rate charged on it, as a fraction: 0.2, 0.15, 0.12, 0.09. */
  rate: number;
}

export interface KayaCommissionGaugeProps {
  /** The ladder, in order, from the country's own configuration. */
  tiers: CommissionTier[];
  /** Deliveries completed today. */
  coursesDone: number;
  /**
   * Spoken description of the ladder (e.g. `t("driverCommissionTiers")`).
   * @kaya/ui never hardcodes user-facing copy.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SEGMENT_HEIGHT = 12;

/**
 * The commission ladder, filled run by run.
 *
 * A driver who knows the seventh run of the day is charged 15% instead of 20%
 * plans their afternoon around it; one who does not is being charged a rate
 * they cannot predict. A table of percentages states that. This is meant to be
 * *felt*: each tier is a bar of as many notches as it has deliveries, they
 * fill as the day goes, and the tier the driver is currently in is the one
 * that is partly full.
 *
 * Reaching a new tier is therefore not an announcement but an arrival — the
 * last notch of a bar completes and the next bar, cheaper, starts filling.
 *
 * The rates are never constants here: they arrive from `country_configs`
 * through the caller, because the day Togo's ladder diverges from Ghana's, a
 * gauge drawn from hardcoded numbers is a gauge that lies to one of them.
 */
export function KayaCommissionGauge({
  tiers,
  coursesDone,
  accessibilityLabel,
  style,
  testID,
}: KayaCommissionGaugeProps) {
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: tiers.length, now: activeIndex(tiers, coursesDone) + 1 }}
      testID={testID}
    >
      {tiers.map((tier, index) => {
        const next = tiers[index + 1];
        // The last tier has no upper bound; it is drawn with the same width as
        // its predecessor so the row does not end in a bar that implies the
        // day stops at delivery 19.
        const span =
          next === undefined
            ? Math.max(tier.from - (tiers[index - 1]?.from ?? 0), 1)
            : next.from - tier.from;
        const doneInTier = Math.min(Math.max(coursesDone - (tier.from - 1), 0), span);

        return (
          <Segment
            key={tier.from}
            index={index}
            span={span}
            filled={doneInTier}
            active={activeIndex(tiers, coursesDone) === index}
            testID={testID === undefined ? undefined : `${testID}-tier-${tier.from}`}
          />
        );
      })}
    </View>
  );
}

/** Which tier the *next* delivery falls in — the one being worked towards. */
function activeIndex(tiers: CommissionTier[], coursesDone: number): number {
  const ordinal = coursesDone + 1;
  let index = 0;
  for (let i = 0; i < tiers.length; i += 1) {
    if (ordinal >= tiers[i]!.from) index = i;
  }
  return index;
}

function Segment({
  index,
  span,
  filled,
  active,
  testID,
}: {
  index: number;
  span: number;
  filled: number;
  active: boolean;
  testID?: string;
}) {
  const ratio = span === 0 ? 0 : filled / span;
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withDelay(
      index * STAGGER_MS,
      withSpring(ratio, { ...progress, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, index, ratio]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View
      style={[styles.segment, { flex: span }]}
      // `-active` marks the tier the next delivery is charged at: a rendering
      // fact a test can read, unlike the fill, which lives on the UI thread.
      testID={testID === undefined ? undefined : `${testID}${active ? "-active" : ""}`}
    >
      <Animated.View
        style={[styles.fill, active ? styles.fillActive : styles.fillDone, fillStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.xs },
  segment: {
    height: SEGMENT_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.pill,
    transformOrigin: "left",
  },
  // The tier being worked in is the one the driver is paying right now.
  fillActive: { backgroundColor: colors.primary },
  // Tiers already left behind read as banked, not as current.
  fillDone: { backgroundColor: colors.success },
});

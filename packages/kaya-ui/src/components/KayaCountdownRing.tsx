import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, typography } from "../theme";

export interface KayaCountdownRingProps {
  /** Seconds left. At or below zero the ring reads empty. */
  seconds: number;
  /** Seconds the countdown started from, which is what makes the ring a ratio. */
  total: number;
  /** Outer diameter. The design uses 52 on the request sheet, 36 in a header. */
  size?: number;
  /**
   * Spoken description (e.g. `t("offersExpiresIn", { count: seconds })`).
   * A bare number read out with no noun is not information.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_SIZE = 52;
const STROKE = 4;
/** Below this many seconds the ring turns from amber to danger. */
const URGENT_BELOW = 5;

/**
 * The time left to answer, as a shrinking ring.
 *
 * Two screens need it: a client watching offers expire, and a driver with
 * fifteen seconds to take a job. Both are counting down to something happening
 * *without them* — the offer lapses, the request goes to another driver — and
 * a number alone makes that a thing to read rather than a thing to feel.
 *
 * Drawn without a vector library on purpose. `react-native-svg` is present in
 * the tree (lucide pulls it in), but an arc that has to be re-drawn every
 * second is a per-frame path recalculation on the JS side; four border edges
 * that empty in sequence cost nothing and read the same at 52px. The colour
 * carries the urgency the geometry cannot.
 */
export function KayaCountdownRing({
  seconds,
  total,
  size = DEFAULT_SIZE,
  accessibilityLabel,
  style,
  testID,
}: KayaCountdownRingProps) {
  const left = Math.max(seconds, 0);
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(left / safeTotal, 1);
  const urgent = left <= URGENT_BELOW;
  const tone = urgent ? colors.danger : colors.amber;

  // Each quarter of the ring empties in turn: at 100% all four edges are
  // coloured, at 25% only the first remains.
  const quarter = (index: number) => (ratio > index / 4 ? tone : colors.border);

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderTopColor: quarter(3),
          borderRightColor: quarter(2),
          borderBottomColor: quarter(1),
          borderLeftColor: quarter(0),
        },
        style,
      ]}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Text
        style={[typography.cardTitle, { color: tone }]}
        testID={testID === undefined ? undefined : `${testID}-value`}
      >
        {left}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: STROKE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});

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

export interface KayaTimelineProps {
  /** How many segments the track is divided into. */
  count: number;
  /**
   * Index of the last completed segment: 0 fills the first, `count - 1` fills
   * them all. Anything below 0 leaves the track empty.
   */
  step: number;
  /**
   * Segments derive `${testID}-step-${index}`, and a filled one additionally
   * carries the `-done` suffix — the convention the tracking, delivery and
   * sign-up screens' tests already query.
   */
  testID?: string;
  /**
   * Spoken description of what is progressing (e.g. `t("trackTitle")`).
   * @kaya/ui never hardcodes user-facing copy, and a progressbar with no
   * label is announced as a bare percentage with nothing to attach it to.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Height of the track. Thin enough to be chrome, thick enough to see fill. */
const TRACK_HEIGHT = 4;

/**
 * A segmented progress track that fills rather than switches.
 *
 * Four screens drew this by hand — client tracking, the driver's run, and both
 * sign-up wizards — each as a row of Views toggling `backgroundColor` on
 * `index <= step`. That toggle is instantaneous, which is the problem: the
 * timeline is the one element on a tracking screen whose entire job is to say
 * *something just moved*, and a colour that changes between two frames is
 * indistinguishable from a re-render. A driver taps "picked up" and the client
 * watching sees a bar that was already like that.
 *
 * So each segment carries a fill that grows from its left edge, and the
 * segments are staggered by `STAGGER_MS` so a jump of two steps reads as a
 * sweep in the direction of travel rather than as two things blinking at once.
 * The spring is `progress` — the slowest token in the system, because this is
 * motion that carries information rather than acknowledging a finger.
 *
 * Mounting animates too: a screen opened mid-run sweeps to where the run
 * actually is, which is a cheaper way of saying "you are here" than any label.
 */
export function KayaTimeline({
  count,
  step,
  testID,
  accessibilityLabel,
  style,
}: KayaTimelineProps) {
  const done = Math.min(Math.max(step + 1, 0), count);

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: count, now: done }}
      // No id of its own: the screens that use this already label their own
      // wrapper (`tracking-timeline`, `delivery-timeline`, `register-steps`),
      // and emitting a second id inside it would make getByTestId ambiguous
      // for the very queries this component has to keep working.
    >
      {Array.from({ length: count }, (_, index) => (
        <Segment
          key={index}
          index={index}
          filled={index <= step}
          testID={testID}
        />
      ))}
    </View>
  );
}

function Segment({
  index,
  filled,
  testID,
}: {
  index: number;
  filled: boolean;
  testID?: string;
}) {
  // Starts empty even when it is already filled at mount, so the track sweeps
  // to its current position on arrival instead of being drawn complete.
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withDelay(
      index * STAGGER_MS,
      withSpring(filled ? 1 : 0, { ...progress, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, filled, index]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View
      style={styles.segment}
      // The `-done` suffix is what four screens' tests already assert on, and
      // it has to stay a *rendering* fact rather than an animated one: the
      // fill's progress lives on the UI thread where no test can read it.
      testID={
        testID === undefined ? undefined : `${testID}-step-${index}${filled ? "-done" : ""}`
      }
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  segment: {
    flex: 1,
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.borderSoft,
    overflow: "hidden",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    // Grows from the left edge rather than out of its own centre: progress has
    // a direction, and a fill that expands both ways does not have it.
    transformOrigin: "left",
  },
});

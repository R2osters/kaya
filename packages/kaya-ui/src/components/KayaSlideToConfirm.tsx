import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ChevronsRight } from "lucide-react-native";
import { colors, radii, spacing, typography } from "../theme";
import { springs } from "../theme/motion";

export interface KayaSlideToConfirmProps {
  /** What confirming does (e.g. `t("driverPickedUp")`). */
  label: string;
  onConfirm: () => void;
  /**
   * `slide` — drag the thumb across. `hold` — press and hold while it fills.
   *
   * Both exist for the same reason and neither is decoration: this control
   * advances a delivery, and a driver's phone spends its day in a jacket
   * pocket or a bike cradle. A tap target that large is pressed by accident
   * eventually, and an accidental "delivered" is an escrow released on a
   * package still strapped to the bike.
   */
  variant?: "slide" | "hold";
  /** Turns the rail and thumb success-toned, for a step that completes work. */
  tone?: "primary" | "success";
  disabled?: boolean;
  /**
   * Spoken hint for how to operate it (e.g. `t("actionSlideHint")`). The
   * gesture is invisible to a screen reader, which is given a plain activate
   * action instead — the protection is against a pocket, not against a user
   * who has deliberately asked their phone to press this for them.
   */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TRACK_HEIGHT = 64;
const THUMB_SIZE = 56;
const THUMB_INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2;

/** Fraction of the travel past which releasing confirms rather than returns. */
const COMMIT_RATIO = 0.8;

/** How long `hold` must be held. Long enough to be deliberate, short enough to not annoy. */
const HOLD_MS = 600;

/**
 * The one control that advances a delivery.
 *
 * Same place, same gesture, every step of the run: only the label changes (En
 * route → Récupéré → En transit → Livré). A driver holding a package on a
 * motorbike is not browsing, and the value of a control they can find without
 * looking is worth more than the half-second a plain button would save.
 */
export function KayaSlideToConfirm({
  label,
  onConfirm,
  variant = "slide",
  tone = "primary",
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: KayaSlideToConfirmProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const travel = Math.max(trackWidth - THUMB_SIZE - THUMB_INSET * 2, 1);

  // 0 at rest, 1 at the far end. Drives the thumb in `slide` and the fill in
  // `hold`, so one value describes "how far towards confirmed are we".
  const value = useSharedValue(0);

  const railColor = tone === "success" ? colors.successTint : colors.primaryTint;
  const thumbColor = tone === "success" ? colors.success : colors.primary;

  const confirm = useCallback(() => {
    onConfirm();
    // Back to rest: the next step reuses this same control, and a thumb left
    // at the far end would show the *previous* action as still pending.
    value.value = withSpring(0, { ...springs.settle, reduceMotion: ReduceMotion.System });
  }, [onConfirm, value]);

  const slide = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && variant === "slide")
        .onUpdate((event) => {
          value.value = Math.min(Math.max(event.translationX / travel, 0), 1);
        })
        .onEnd(() => {
          if (value.value >= COMMIT_RATIO) {
            value.value = withSpring(1, { ...springs.sheet, reduceMotion: ReduceMotion.System });
            runOnJS(confirm)();
            return;
          }
          // Released short of the commit point: the thumb returns on the press
          // spring, which is the same "nothing happened" the rest of the app
          // uses when a press is cancelled.
          value.value = withSpring(0, { ...springs.press, reduceMotion: ReduceMotion.System });
        }),
    [confirm, disabled, travel, value, variant],
  );

  const hold = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(!disabled && variant === "hold")
        .minDuration(HOLD_MS)
        .onBegin(() => {
          value.value = withTiming(1, { duration: HOLD_MS, reduceMotion: ReduceMotion.System });
        })
        .onStart(() => {
          runOnJS(confirm)();
        })
        .onFinalize((_event, success) => {
          if (!success) {
            // Let go early: the fill empties rather than freezing, so the
            // control never sits half-committed to an action it did not take.
            value.value = withSpring(0, { ...springs.settle, reduceMotion: ReduceMotion.System });
          }
        }),
    [confirm, disabled, value, variant],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: variant === "slide" ? value.value * travel : 0 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    // In `hold` the fill is the whole feedback; in `slide` it trails the thumb
    // so the track reads as being consumed rather than merely travelled.
    transform: [{ scaleX: value.value }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <GestureDetector gesture={variant === "slide" ? slide : hold}>
      <View
        style={[styles.track, { backgroundColor: railColor }, disabled && styles.disabled, style]}
        onLayout={onLayout}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        onAccessibilityTap={disabled ? undefined : onConfirm}
        onAccessibilityAction={disabled ? undefined : onConfirm}
        accessibilityActions={[{ name: "activate" }]}
        testID={testID}
      >
        <Animated.View
          style={[styles.fill, { backgroundColor: thumbColor }, fillStyle]}
          pointerEvents="none"
        />
        <Text style={[typography.button, styles.label]} numberOfLines={1} pointerEvents="none">
          {label}
        </Text>
        <Animated.View
          style={[styles.thumb, { backgroundColor: thumbColor }, thumbStyle]}
          pointerEvents="none"
          testID={testID === undefined ? undefined : `${testID}-thumb`}
        >
          <ChevronsRight size={22} color={colors.surface} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    justifyContent: "center",
    overflow: "hidden",
  },
  disabled: { opacity: 0.5 },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.pill,
    opacity: 0.25,
    transformOrigin: "left",
  },
  // Centred in the track, not after the thumb: the label is what the control
  // *is*, and it has to stay readable while the thumb travels over it.
  label: { textAlign: "center", color: colors.ink, paddingHorizontal: THUMB_SIZE + spacing.sm },
  thumb: {
    position: "absolute",
    left: THUMB_INSET,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});

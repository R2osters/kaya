import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { PRESS_SCALE, pressIn, springs } from "../theme/motion";

export interface KayaPressableProps extends Omit<PressableProps, "style"> {
  children: ReactNode;
  /** Styles the animated wrapper, which is the visible surface. */
  style?: StyleProp<ViewStyle>;
  /**
   * Skips the sink. For controls whose feedback is already carried elsewhere
   * (a row that navigates instantly, an opacity-based control), a second
   * signal is noise.
   */
  noScale?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that answers the finger the moment it lands.
 *
 * Feedback fires on press-*in*, never on release: the ~100ms sink is the
 * "I felt that" signal, and waiting for touch-up to show anything reads as
 * dead. The way in is a short timing curve — monotonic, instantaneous — and
 * the way back is a critically-damped spring, so a press that is cancelled or
 * released mid-flight rejoins rest from wherever it actually is rather than
 * jumping. (Springs animate from the current value; that is the whole reason
 * to use one here.)
 *
 * This is the press behaviour for every touchable surface in the design
 * system — KayaButton uses it internally, and screens use it directly for
 * tappable cards and rows so the app answers the finger everywhere, not only
 * on buttons.
 */
export function KayaPressable({
  children,
  style,
  noScale = false,
  disabled,
  ...pressableProps
}: KayaPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...pressableProps}
      disabled={disabled}
      onPressIn={(event) => {
        if (!noScale && disabled !== true) {
          scale.value = withTiming(PRESS_SCALE, pressIn);
        }
        pressableProps.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!noScale) {
          scale.value = withSpring(1, springs.press);
        }
        pressableProps.onPressOut?.(event);
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors, radii } from "../theme";

export interface KayaSkeletonProps {
  width?: number;
  height?: number;
  radius?: number;
  testID?: string;
}

const DEFAULT_HEIGHT = 14;
const MIN_OPACITY = 0.4;
const MAX_OPACITY = 1;
// One leg of the fade (out or in). A full loop — fade out, fade back in — is
// therefore roughly the ~1s the brief asks for.
const HALF_LOOP_MS = 500;

/**
 * Base shimmering placeholder box, self-animating. The Dart original used the
 * `shimmer` package's sliding gradient; this ports it as a plain opacity
 * pulse instead, per the brief — reanimated has no bundled gradient shimmer,
 * and pulling in a second animation dependency for one effect isn't
 * justified. Compose several inside a list/card layout, or use standalone.
 */
export function KayaSkeleton({ width, height = DEFAULT_HEIGHT, radius, testID }: KayaSkeletonProps) {
  const opacity = useSharedValue(MAX_OPACITY);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(MIN_OPACITY, { duration: HALF_LOOP_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID={testID}
      // A screen reader must announce "loading", not read an empty box.
      accessibilityState={{ busy: true }}
      style={[styles.base, { width, height, borderRadius: radius ?? radii.field }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.background },
});

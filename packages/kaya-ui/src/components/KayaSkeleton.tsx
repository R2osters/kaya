import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors, radii } from "../theme";

export interface KayaSkeletonProps {
  width?: number;
  height?: number;
  radius?: number;
  /**
   * Caller-supplied loading announcement (e.g. `t("common.loading")").
   * @kaya/ui never hardcodes user-facing copy, and that includes copy a
   * screen reader speaks. When given, this box becomes an accessibility
   * element in its own right -- `accessible`, `accessibilityRole="progressbar"`
   * and `accessibilityState={{ busy: true }}` -- so VoiceOver/TalkBack
   * announce it instead of silently skipping an unlabeled node.
   *
   * Omit this when the skeleton is composed inside a grouping parent that
   * already announces `busy` once at its own root (KayaSkeletonCard,
   * KayaSkeletonList, KayaSkeletonListTile): giving every child box its own
   * label there would repeat the announcement once per box.
   */
  accessibilityLabel?: string;
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
 *
 * Accessibility: on its own, a plain View with no accessibility props is not
 * an accessibility element -- VoiceOver/TalkBack skip it entirely, so a
 * blind user cannot tell a loading screen from an empty one. Pass
 * `accessibilityLabel` when using this standalone to fix that; leave it
 * unset when composing several inside a grouping parent that already
 * announces `busy` once at its own root (see KayaSkeletonCard.tsx).
 */
export function KayaSkeleton({ width, height = DEFAULT_HEIGHT, radius, accessibilityLabel, testID }: KayaSkeletonProps) {
  const opacity = useSharedValue(MAX_OPACITY);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(MIN_OPACITY, { duration: HALF_LOOP_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const announcesBusy = accessibilityLabel !== undefined;

  return (
    <Animated.View
      testID={testID}
      // Only becomes an accessibility element -- and only then announces
      // "loading" -- when the caller supplies a label. See the doc comment
      // on KayaSkeletonProps.accessibilityLabel above.
      accessible={announcesBusy}
      accessibilityRole={announcesBusy ? "progressbar" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={announcesBusy ? { busy: true } : undefined}
      style={[styles.base, { width, height, borderRadius: radius ?? radii.field }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.background },
});

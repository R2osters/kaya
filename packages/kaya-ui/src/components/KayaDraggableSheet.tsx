import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, radii, shadows, spacing } from "../theme";
import { springs } from "../theme/motion";

export interface KayaDraggableSheetProps {
  children: ReactNode;
  /**
   * Fraction of the window the sheet covers when resting low, leaving the map
   * above it readable. 0–1.
   */
  collapsedRatio?: number;
  /** Fraction of the window the sheet covers when pulled up. 0–1. */
  expandedRatio?: number;
  /** Called on every settle, with the detent the sheet landed on. */
  onSnap?: (detent: "collapsed" | "expanded") => void;
  /**
   * Spoken description of the grab handle (e.g. `t("driverNearbyRequests")`).
   * @kaya/ui never hardcodes user-facing copy, and an unlabelled control that
   * resizes half the screen is not usable without sight.
   */
  handleAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_COLLAPSED_RATIO = 0.48;
const DEFAULT_EXPANDED_RATIO = 0.88;

/**
 * How far past halfway a drag must go to change detent, as a fraction of the
 * travel. Below this, the sheet returns where it came from — a 5px wobble
 * while scrolling a list must not resize the screen.
 */
const COMMIT_FRACTION = 0.5;

/**
 * A velocity this fast decides the detent on its own, whatever the distance.
 * A flick is an instruction; making someone drag past a midpoint to be obeyed
 * is the difference between a sheet that feels attached to the finger and one
 * that argues with it. Points per second.
 */
const FLICK_VELOCITY = 700;

/**
 * The persistent bottom sheet: a panel pinned to the bottom edge that the user
 * can pull up and push back down, with the map still doing its job above it.
 *
 * Distinct from `BottomSheetShell`, which is modal — it dims the screen, traps
 * focus and exists to be dismissed. This one is never dismissed and never
 * covers everything: it is a second pane of the same screen, and the whole
 * point is that the driver chooses how much of it they want against how much
 * map they want.
 *
 * It was a fixed-height View before this. The height was chosen once, for
 * everyone, and a driver with six nearby jobs scrolled a list through a 48%
 * window while the map underneath showed them nothing they were not already
 * looking at.
 *
 * The spring is `springs.sheet` — the one token in the system with overshoot,
 * and this is what it is for: the sheet is carrying the momentum of a real
 * finger, so a little bounce reads as the energy the gesture put in rather
 * than as decoration.
 */
export function KayaDraggableSheet({
  children,
  collapsedRatio = DEFAULT_COLLAPSED_RATIO,
  expandedRatio = DEFAULT_EXPANDED_RATIO,
  onSnap,
  handleAccessibilityLabel,
  style,
  testID,
}: KayaDraggableSheetProps) {
  const { height: windowHeight } = useWindowDimensions();

  const collapsed = Math.round(windowHeight * collapsedRatio);
  const expanded = Math.round(windowHeight * expandedRatio);
  const travel = Math.max(expanded - collapsed, 1);

  const height = useSharedValue(collapsed);
  // Height when the current drag began, so a gesture is measured from where
  // the sheet actually was rather than from its last detent — a drag started
  // mid-flight must not jump.
  const startHeight = useSharedValue(collapsed);
  const isExpanded = useSharedValue(false);

  // A rotation or a split-screen resize changes both detents underneath a
  // sheet already resting on one of them.
  useEffect(() => {
    height.value = withSpring(isExpanded.value ? expanded : collapsed, {
      ...springs.settle,
      reduceMotion: ReduceMotion.System,
    });
  }, [collapsed, expanded, height, isExpanded]);

  const report = useCallback(
    (next: boolean) => {
      onSnap?.(next ? "expanded" : "collapsed");
    },
    [onSnap],
  );

  // Built once per detent change rather than per render: a gesture rebuilt on
  // every frame of its own drag is a gesture that detaches mid-drag.
  const drag = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startHeight.value = height.value;
        })
        .onUpdate((event) => {
          // Upward drags are negative translation and must grow the sheet,
          // hence the subtraction. Clamped to the two detents: a sheet that
          // can be dragged past its own limits and springs back is reporting a
          // boundary it does not have.
          const next = startHeight.value - event.translationY;
          height.value = Math.min(Math.max(next, collapsed), expanded);
        })
        .onEnd((event) => {
          // velocityY is positive downward, so a fast *negative* velocity
          // expands. A flick decides on its own, whatever the distance.
          const next =
            Math.abs(event.velocityY) > FLICK_VELOCITY
              ? event.velocityY < 0
              : (height.value - collapsed) / travel > COMMIT_FRACTION;

          isExpanded.value = next;
          height.value = withSpring(next ? expanded : collapsed, {
            ...springs.sheet,
            reduceMotion: ReduceMotion.System,
          });
          runOnJS(report)(next);
        }),
    [collapsed, expanded, height, isExpanded, report, startHeight, travel],
  );

  const toggle = useCallback(() => {
    // The tap target for anyone who does not drag, and the action a screen
    // reader is given: a gesture with no button behind it is a control that
    // does not exist for a large part of the audience.
    const next = !isExpanded.value;
    isExpanded.value = next;
    height.value = withSpring(next ? expanded : collapsed, {
      ...springs.sheet,
      reduceMotion: ReduceMotion.System,
    });
    report(next);
  }, [collapsed, expanded, height, isExpanded, report]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View style={[styles.sheet, animatedStyle, style]} testID={testID}>
      <GestureDetector gesture={drag}>
        {/* The grab area is deliberately taller than the bar it draws: a 5px
            target is a target nobody hits on a moving motorbike. */}
        <View
          style={styles.handleArea}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={handleAccessibilityLabel}
          accessibilityActions={[{ name: "activate" }, { name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={toggle}
          testID={testID === undefined ? undefined : `${testID}-handle`}
        >
          <View style={styles.grabber} />
        </View>
      </GestureDetector>

      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    ...shadows.sheet,
  },
  handleArea: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
});

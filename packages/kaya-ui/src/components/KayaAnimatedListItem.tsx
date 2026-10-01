import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  type AnimatedProps,
} from "react-native-reanimated";
import { ENTER_MS, STAGGER_MAX_STEPS, STAGGER_MS, springs } from "../theme/motion";

export interface KayaAnimatedListItemProps {
  children: ReactNode;
  /**
   * Rank in the list. Drives the stagger, capped at `STAGGER_MAX_STEPS` so a
   * long list does not make its own tail wait.
   */
  index?: number;
  /**
   * Skips the entrance but keeps the layout transition. For a row that is
   * already on screen and only ever moves — a reordered list whose items
   * should slide, not re-arrive.
   */
  noEntering?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The wrapper that gives a list row an arrival and a way of moving.
 *
 * Two things, and they answer different questions. `entering` covers rows the
 * user has not seen before: a bid landing over the socket while the client is
 * looking at the offer list, a nearby request appearing for a driver who just
 * went online. Those arrive *because something happened elsewhere*, and a row
 * that materialises between two frames is the one case where the user is
 * entitled to think the app glitched rather than that a driver bid.
 *
 * `layout` covers the rest of the list: when a row is inserted above them, the
 * others slide down instead of teleporting, so the list reads as one object
 * being added to rather than as a redraw. Critically damped — the rows are not
 * carrying anyone's momentum, and overshoot on a price list looks like a bug.
 *
 * Both are marked `ReduceMotion.System`: a user who has asked their phone for
 * less motion gets the rows immediately, with no entrance and no slide.
 */
export function KayaAnimatedListItem({
  children,
  index = 0,
  noEntering = false,
  style,
  testID,
}: KayaAnimatedListItemProps) {
  const delay = Math.min(index, STAGGER_MAX_STEPS) * STAGGER_MS;

  const entering: AnimatedProps<ViewStyle>["entering"] = noEntering
    ? undefined
    : FadeInDown.duration(ENTER_MS).delay(delay).reduceMotion(ReduceMotion.System);

  return (
    <Animated.View
      entering={entering}
      layout={LinearTransition.springify()
        .duration(springs.settle.duration)
        .dampingRatio(springs.settle.dampingRatio)
        .reduceMotion(ReduceMotion.System)}
      style={style}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}

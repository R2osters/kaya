import { useEffect, useRef } from "react";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { colors, typography } from "../theme";
import { springs } from "../theme/motion";

export interface KayaCountBadgeProps {
  /** Items outstanding. At zero or below, nothing renders at all. */
  count: number;
  /** Above this, the label becomes `${max}+`. */
  max?: number;
  /**
   * Spoken description of what is being counted (e.g.
   * `t("notificationsUnread", { count })`). Without it a screen reader
   * announces a bare number floating next to a bell.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_MAX = 9;
/** How far the badge swells when the count changes. */
const POP_SCALE = 1.3;

/**
 * The count that rides on a bell.
 *
 * Both home screens had drawn this by hand, byte for byte, down to the -2/-2
 * offsets — the kind of duplication that survives right up until one of the
 * two is adjusted and the apps quietly stop matching.
 *
 * The motion is the point of extracting it rather than merely deduplicating.
 * This number changes *while the user is looking at a different part of the
 * screen*: a push arrives, `useNotifications`' key is invalidated, and the
 * badge goes from 2 to 3 with nothing to draw the eye. The pop is a peripheral
 * signal — swell and settle, ~300ms — and it fires on every change including
 * the first appearance, which is the change that matters most.
 */
export function KayaCountBadge({
  count,
  max = DEFAULT_MAX,
  accessibilityLabel,
  style,
  testID,
}: KayaCountBadgeProps) {
  const visible = count > 0;
  const scale = useSharedValue(0);
  // The count as of the last render that showed one, so a *decrease* (the user
  // read something) settles quietly rather than celebrating.
  const previous = useRef(0);

  useEffect(() => {
    if (!visible) {
      previous.current = 0;
      scale.value = 0;
      return;
    }

    const grew = count > previous.current;
    previous.current = count;

    const config = { ...springs.press, reduceMotion: ReduceMotion.System };
    scale.value = grew
      ? withSequence(withSpring(POP_SCALE, config), withSpring(1, config))
      : withSpring(1, config);
  }, [count, scale, visible]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.badge, animatedStyle, style]}
      accessibilityLabel={accessibilityLabel}
      accessible={accessibilityLabel !== undefined}
      testID={testID}
    >
      <Text style={styles.label}>{count > max ? `${max}+` : String(count)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Overlapping its parent's top-right corner, the way every inbox badge
  // does: it has to read as attached to the bell, not as a second control.
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...typography.caption,
    color: colors.surface,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },
});

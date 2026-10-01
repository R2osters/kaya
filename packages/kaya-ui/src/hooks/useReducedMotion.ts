import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the user has asked their phone for less motion.
 *
 * Reanimated's `ReduceMotion.System` already covers animations that run on the
 * UI thread — every entering animation and spring in this package passes it.
 * This is the JS-side counterpart, for motion that is driven from JavaScript
 * and therefore cannot consult a worklet-side setting: a marker glided between
 * GPS fixes, a sheet snapped to a detent.
 *
 * Reanimated does export a `useReducedMotion` of its own, but its Jest mock
 * does not implement it, so every test touching a component that used it would
 * fail on an undefined call. Built on `AccessibilityInfo`, which the React
 * Native preset does provide, this works the same in both places.
 *
 * The setting is read once on mount and then followed: it is a system toggle
 * the user can flip from the notification shade without leaving the app.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (active) setReduced(enabled);
      })
      // A platform that cannot answer is not a reason to fail a render; the
      // default (full motion) is what every device without the setting does.
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled: boolean) => {
        setReduced(enabled);
      },
    );

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return reduced;
}

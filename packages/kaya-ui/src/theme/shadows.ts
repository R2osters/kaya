import type { ViewStyle } from "react-native";

/**
 * Soft depth, not heavy drops. The Flutter side expressed these as BoxShadow
 * with a negative spread; React Native has no spread, so the blur is reduced to
 * approximate the same visual weight, and `elevation` carries Android.
 */
export type Shadow = Required<
  Pick<ViewStyle, "shadowColor" | "shadowOpacity" | "shadowRadius" | "elevation">
> & { shadowOffset: { width: number; height: number } };

export const shadows = Object.freeze({
  card: Object.freeze({
    shadowColor: "#0B1220",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  }),
  soft: Object.freeze({
    shadowColor: "#0B1220",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  }),
  /** Bottom sheets cast upward. */
  sheet: Object.freeze({
    shadowColor: "#0B1220",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  }),
}) as Readonly<Record<"card" | "soft" | "sheet", Shadow>>;

import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, typography } from "../theme";

export type StatusTone = "primary" | "success" | "danger" | "amber" | "neutral";

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  /**
   * Leading icon. As with `KayaButton`, prefer the function form: it receives
   * the tone's foreground colour so the icon stays legible against the tint.
   * The Flutter original tinted an `IconData` directly; React cannot recolour
   * an arbitrary node, so a plain `ReactNode` must arrive already coloured.
   */
  icon?: ReactNode | ((color: string) => ReactNode);
  dense?: boolean;
  testID?: string;
}

const TONES: Record<StatusTone, { background: string; foreground: string }> = {
  primary: { background: colors.primaryTint, foreground: colors.primary },
  success: { background: colors.successTint, foreground: colors.success },
  danger: { background: colors.dangerTint, foreground: colors.danger },
  amber: { background: colors.amberTint, foreground: colors.amber },
  neutral: { background: colors.background, foreground: colors.inkSecondary },
};

/** Pill-shaped status badge (999px radius). Used for order/delivery states. */
export function StatusPill({ label, tone = "primary", icon, dense = false, testID }: StatusPillProps) {
  const { background, foreground } = TONES[tone];

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: background },
        dense ? styles.dense : styles.regular,
      ]}
    >
      {icon !== undefined && (
        <View style={styles.icon}>{typeof icon === "function" ? icon(foreground) : icon}</View>
      )}
      <Text style={[typography.caption, styles.label, { color: foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
  },
  regular: { paddingHorizontal: 12, paddingVertical: 6 },
  dense: { paddingHorizontal: 10, paddingVertical: 4 },
  icon: { marginRight: 5 },
  label: { fontWeight: "700" },
});

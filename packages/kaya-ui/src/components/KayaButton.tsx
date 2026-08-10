import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, minTouch, radii, spacing, typography } from "../theme";

export type KayaButtonVariant = "primary" | "secondary" | "danger";

export interface KayaButtonProps {
  label: string;
  onPress?: () => void;
  variant?: KayaButtonVariant;
  /**
   * Leading icon. Prefer the function form: it receives the variant's
   * foreground colour, which is what keeps an icon legible on a filled button.
   * The Flutter original tinted the icon itself; React cannot recolour an
   * arbitrary node, so a plain `ReactNode` must arrive already coloured — pass
   * `(color) => <Send size={18} color={color} />` and it is handled for you.
   */
  icon?: ReactNode | ((color: string) => ReactNode);
  loading?: boolean;
  /**
   * Refuses presses without showing a spinner.
   *
   * Distinct from `loading`, which says "this button's own work is running".
   * A row of Accept buttons while one of them is being accepted needs the
   * other rows dead but quiet: a spinner on each would claim they were all
   * working. The greyed-out treatment below is shared with the
   * no-handler case, which is the same state arrived at differently.
   */
  disabled?: boolean;
  /** Stretch to the available width. Defaults to true, as the Flutter widget did. */
  expand?: boolean;
  testID?: string;
}

const FILL: Record<KayaButtonVariant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  danger: colors.danger,
};

/** Primary call to action. Never shorter than the 44px touch target. */
export function KayaButton({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled: disabledProp = false,
  expand = true,
  testID,
}: KayaButtonProps) {
  const disabled = onPress === undefined || loading || disabledProp;
  const filled = variant !== "secondary";
  const foreground = filled ? colors.surface : colors.ink;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        { backgroundColor: FILL[variant] },
        !filled && styles.outlined,
        expand ? styles.expand : styles.hug,
        // A loading button is disabled too, but the spinner already says so —
        // dimming it as well reads as "broken" rather than "working".
        { opacity: disabled && !loading ? 0.5 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator testID={testID ? `${testID}-spinner` : undefined} color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon !== undefined && (
            <View style={styles.icon}>
              {typeof icon === "function" ? icon(foreground) : icon}
            </View>
          )}
          <Text numberOfLines={1} style={[typography.button, { color: foreground }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch,
    borderRadius: radii.button,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  outlined: { borderWidth: 1.4, borderColor: colors.border },
  expand: { alignSelf: "stretch" },
  hug: { alignSelf: "flex-start" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icon: { marginRight: spacing.sm },
});

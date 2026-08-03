import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";
import { KayaButton } from "./KayaButton";

export interface EmptyStateProps {
  /**
   * Follows the shared icon convention from `KayaButton`/`StatusPill`: pass a
   * plain node, or `(color) => <Icon color={color} />` to receive the
   * tertiary ink tint the Dart original applied to its `IconData`.
   */
  icon: ReactNode | ((color: string) => ReactNode);
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

const ICON_CIRCLE_SIZE = 72;

/** Centered empty/placeholder state with optional action. */
export function EmptyState({ icon, title, message, actionLabel, onAction, testID }: EmptyStateProps) {
  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.iconCircle}>{typeof icon === "function" ? icon(colors.inkTertiary) : icon}</View>
      <Text style={[typography.cardTitle, styles.title]}>{title}</Text>
      {message !== undefined && <Text style={[typography.bodySecondary, styles.message]}>{message}</Text>}
      {actionLabel !== undefined && onAction !== undefined && (
        <View style={styles.action}>
          <KayaButton label={actionLabel} onPress={onAction} expand={false} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: spacing.xxxl },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: ICON_CIRCLE_SIZE / 2,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { textAlign: "center" },
  message: { textAlign: "center", marginTop: spacing.sm },
  action: { marginTop: spacing.xl },
});

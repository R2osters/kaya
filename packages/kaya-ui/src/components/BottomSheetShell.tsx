import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, shadows, spacing, typography } from "../theme";

export interface BottomSheetShellProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}

/**
 * Bottom-sheet container with 28px top radius, grab handle, and optional
 * title. `showModalBottomSheet` gave the Flutter original backdrop-press and
 * hardware-back dismissal for free; React Native has no such default, so
 * both are wired explicitly here. Skipping the hardware-back wiring would
 * trap an Android user inside the sheet, since there is no other system-level
 * dismiss gesture.
 */
export function BottomSheetShell({ visible, onClose, title, children, testID }: BottomSheetShellProps) {
  // Mounting the Modal only while visible (rather than handing `visible`
  // straight to <Modal>) keeps "renders children only when visible" a plain,
  // testable fact instead of depending on the platform's modal-presentation
  // behaviour.
  if (!visible) return null;

  return (
    <Modal testID={testID} visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          testID={testID ? `${testID}-backdrop` : undefined}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {title !== undefined && (
            <Text testID={testID ? `${testID}-title` : undefined} style={[typography.sectionTitle, styles.title]}>
              {title}
            </Text>
          )}
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    ...shadows.sheet,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  title: { marginTop: spacing.lg },
  content: { marginTop: spacing.lg },
});

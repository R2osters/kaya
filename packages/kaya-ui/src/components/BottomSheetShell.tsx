import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, shadows, spacing, typography } from "../theme";

export interface BottomSheetShellProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Accessibility label read for the full-screen backdrop's dismiss action
   * (e.g. `t("common.dismissSheet")`). @kaya/ui never hardcodes user-facing
   * copy, including copy a screen reader speaks -- without this, VoiceOver
   * and TalkBack announce an unlabeled button covering the whole screen.
   */
  dismissAccessibilityLabel?: string;
  children: ReactNode;
  testID?: string;
}

// Caps how much of the screen a sheet can occupy, so a tall list (addresses,
// offers) cannot push the grab handle and title off the top with no way to
// scroll back to them. The Dart original achieved the same cap by wrapping
// its child in `Flexible` inside a `mainAxisSize.min` Column; React Native
// has no such implicit cap (a View defaults to `flexShrink: 0`), so it is
// expressed here instead as an explicit fraction of the window height.
const MAX_HEIGHT_RATIO = 0.9;

/**
 * Bottom-sheet container with 28px top radius, grab handle, and optional
 * title. `showModalBottomSheet` gave the Flutter original backdrop-press,
 * hardware-back dismissal, a dimmed barrier, and modal focus semantics for
 * free; React Native has no such default, so all four are wired explicitly
 * here. Skipping the hardware-back wiring would trap an Android user inside
 * the sheet, since there is no other system-level dismiss gesture.
 */
export function BottomSheetShell({
  visible,
  onClose,
  title,
  dismissAccessibilityLabel,
  children,
  testID,
}: BottomSheetShellProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Real device insets, now that phase 1C task 4 wires up a SafeAreaProvider
  // at the app root (this was fixed padding before that provider existed --
  // see the removed `paddingBottom` in `styles.sheet` below). `spacing.xxl`
  // stays the floor: a device that reports zero inset (no home indicator, or
  // this component under test with no provider at all) must not lose the
  // breathing room the fixed value used to guarantee unconditionally; a
  // device with a real indicator gets exactly enough padding to clear it,
  // never less.
  const bottomPadding = Math.max(insets.bottom, spacing.xxl);

  // Mounting the Modal only while visible (rather than handing `visible`
  // straight to <Modal>) keeps "renders children only when visible" a plain,
  // testable fact instead of depending on the platform's modal-presentation
  // behaviour.
  if (!visible) return null;

  return (
    <Modal testID={testID} visible transparent animationType="slide" onRequestClose={onClose}>
      <View
        testID={testID ? `${testID}-overlay` : undefined}
        style={styles.overlay}
        accessibilityViewIsModal
      >
        <Pressable
          testID={testID ? `${testID}-backdrop` : undefined}
          // Only a button to assistive technology once the caller has said
          // what it does. An unlabelled button covering the entire screen is
          // worse than an unreachable one: a screen reader announces "button"
          // and the user has no idea what pressing it would dismiss.
          accessible={dismissAccessibilityLabel !== undefined}
          accessibilityRole={dismissAccessibilityLabel !== undefined ? "button" : undefined}
          accessibilityLabel={dismissAccessibilityLabel}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          testID={testID ? `${testID}-panel` : undefined}
          style={[
            styles.sheet,
            { maxHeight: windowHeight * MAX_HEIGHT_RATIO, paddingBottom: bottomPadding },
          ]}
        >
          <View style={styles.handle} />
          {title !== undefined && (
            <Text testID={testID ? `${testID}-title` : undefined} style={[typography.sectionTitle, styles.title]}>
              {title}
            </Text>
          )}
          <ScrollView
            testID={testID ? `${testID}-content` : undefined}
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    // paddingBottom is computed from the safe-area inset above and applied
    // inline, not here -- it needs a value only available at render time.
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
  // flexShrink: 1 is what lets this ScrollView be constrained by `sheet`'s
  // maxHeight instead of growing to its content's full size -- without it,
  // the ScrollView takes its natural (unbounded) height and never actually
  // needs to scroll, defeating the cap above.
  content: { marginTop: spacing.lg, flexShrink: 1 },
});

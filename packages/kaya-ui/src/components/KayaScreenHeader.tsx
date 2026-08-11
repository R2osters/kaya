import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "../theme";
import { KayaPressable } from "./KayaPressable";

export interface KayaScreenHeaderProps {
  title: string;
  /**
   * Called when the back control is pressed. Omit on a screen that is a root
   * of its own stack (a tab) -- the control then does not render at all,
   * rather than rendering something that goes nowhere.
   */
  onBack?: () => void;
  /** Optional trailing control: a bell, a menu, an action. */
  right?: ReactNode;
  testID?: string;
}

/**
 * The title row for a pushed screen, with the way back.
 *
 * Every screen used to render a bare `<Text style={typography.screenTitle}>`,
 * and the root layout hides the navigator's own header, so a pushed screen had
 * no visible way back at all. Android's gesture and hardware back still
 * popped it, which is exactly what made this easy to miss in development and
 * impossible to miss on a device: a user who opens notifications and looks for
 * a way out finds nothing on screen, and the app reads as a dead end. Reported
 * from the emulator.
 *
 * The control renders only when `onBack` is given, so a tab root keeps a plain
 * title instead of growing a chevron that pops nothing.
 *
 * Sized to the same 40px circle as the home screen's bell, and placed on the
 * same line as the title rather than above it: one row of chrome, not two.
 */
export function KayaScreenHeader({ title, onBack, right, testID }: KayaScreenHeaderProps) {
  // The header is the top-most thing on every pushed screen, and the screens
  // it sits in pad their content but not the status bar. Without this the row
  // renders *under* the status bar: on the emulator the back control sat at
  // y=63-168 with the bar occupying the same strip, so it drew correctly,
  // reported itself clickable, and swallowed every tap -- while a sibling
  // control 100px lower navigated fine. The inset is applied here rather than
  // asked of each screen because forgetting it is invisible until someone
  // taps.
  const insets = useSafeAreaInsets();

  return (
    // `-header`, not the bare testID: screens pass their own root's id (so the
    // title lands on the `${id}-title` every existing test already queries),
    // and emitting it again here made getByTestId(root) ambiguous.
    <View
      style={[styles.row, { paddingTop: insets.top }]}
      testID={testID === undefined ? undefined : `${testID}-header`}
    >
      {onBack !== undefined && (
        <KayaPressable
          onPress={onBack}
          style={styles.back}
          // No hitSlop. It was here to make a 40px circle forgiving for a
          // thumb, and on the device the control rendered, reported itself
          // clickable to the accessibility tree, and did nothing at all when
          // tapped -- hitSlop on an Animated Pressable under Fabric breaks the
          // hit test rather than widening it. The circle is already at the
          // design system's 44px-ish target on its own.
          accessibilityLabel={title}
          testID={testID === undefined ? "screen-back" : `${testID}-back`}
        >
          <ChevronLeft size={22} color={colors.ink} />
        </KayaPressable>
      )}

      <Text
        style={[typography.screenTitle, styles.title]}
        numberOfLines={1}
        testID={testID === undefined ? undefined : `${testID}-title`}
      >
        {title}
      </Text>

      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // Takes the remaining width so a long title ellipsises instead of pushing
  // the trailing control off screen.
  title: { flex: 1 },
});

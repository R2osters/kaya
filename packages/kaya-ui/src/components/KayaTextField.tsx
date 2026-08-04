import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

export interface KayaTextFieldProps {
  label?: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  /**
   * Leading icon, tinted `inkTertiary` to match the Dart original's fixed
   * `IconData` colour. Follows the shared icon convention from `KayaButton`
   * and `StatusPill`: pass a plain node, or `(color) => <Icon color={color} />`
   * when the icon needs the tint handed to it.
   */
  prefixIcon?: ReactNode | ((color: string) => ReactNode);
  /** Trailing icon or action (e.g. a password-visibility toggle). Same convention as `prefixIcon`. */
  suffixIcon?: ReactNode | ((color: string) => ReactNode);
  multiline?: boolean;
  /**
   * Validation message, owned and computed by the caller. The Flutter
   * original took a `validator` and relied on Flutter's form machinery,
   * which React has no equivalent for — so the message arrives pre-computed
   * instead. Rendered in `danger` beneath the field and exposed as an
   * `alert` so assistive technology announces it rather than only showing it.
   */
  error?: string;
  editable?: boolean;
  testID?: string;
}

/** Labelled text field consistent with the design system input theme. */
export function KayaTextField({
  label,
  hint,
  value,
  onChangeText,
  keyboardType,
  secureTextEntry = false,
  prefixIcon,
  suffixIcon,
  multiline = false,
  error,
  editable = true,
  testID,
}: KayaTextFieldProps) {
  const invalid = error !== undefined && error !== "";
  // Mirrors the Dart original: `maxLines: obscureText ? 1 : maxLines` — an
  // obscured field is never allowed to grow multiline.
  const isMultiline = secureTextEntry ? false : multiline;

  return (
    <View testID={testID}>
      {label !== undefined && (
        <Text testID={testID ? `${testID}-label` : undefined} style={[typography.bodyStrong, styles.label]}>
          {label}
        </Text>
      )}
      <View
        testID={testID ? `${testID}-box` : undefined}
        style={[
          styles.box,
          isMultiline && styles.boxMultiline,
          invalid && styles.boxInvalid,
          !editable && styles.boxDisabled,
        ]}
      >
        {prefixIcon !== undefined && (
          <View style={styles.affix}>{typeof prefixIcon === "function" ? prefixIcon(colors.inkTertiary) : prefixIcon}</View>
        )}
        <TextInput
          testID={testID ? `${testID}-input` : undefined}
          style={[typography.body, styles.input]}
          value={value}
          onChangeText={onChangeText}
          placeholder={hint}
          placeholderTextColor={colors.inkTertiary}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={isMultiline}
          editable={editable}
          accessibilityLabel={label}
          // React Native has no way to point an input at a separate error node
          // the way web ARIA's aria-describedby does, so the message is carried
          // on the input itself. Without this the error is a node a screen
          // reader only meets if it happens to swipe past it — the person who
          // most needs to know the field is wrong is the least likely to find out.
          accessibilityHint={invalid ? error : hint}
          accessibilityState={{ disabled: !editable }}
        />
        {suffixIcon !== undefined && (
          <View style={styles.affix}>{typeof suffixIcon === "function" ? suffixIcon(colors.inkTertiary) : suffixIcon}</View>
        )}
      </View>
      {invalid && (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          accessibilityRole="alert"
          // `role="alert"` alone announces nothing in React Native — unlike web
          // ARIA, nothing watches the node for changes. `accessibilityLiveRegion`
          // is what actually makes TalkBack speak the message when it appears;
          // on iOS the same job falls to the input's hint above.
          accessibilityLiveRegion="polite"
          style={[typography.caption, styles.error]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  boxMultiline: { alignItems: "flex-start", paddingVertical: spacing.sm },
  boxInvalid: { borderColor: colors.danger },
  boxDisabled: { backgroundColor: colors.background },
  affix: { marginHorizontal: spacing.xs },
  input: { flex: 1, paddingVertical: spacing.sm },
  error: { color: colors.danger, marginTop: spacing.xs },
});

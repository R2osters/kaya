import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../theme";

export interface KayaCardProps {
  children: ReactNode;
  padding?: number;
  onPress?: () => void;
  radius?: number;
  border?: boolean;
  color?: string;
  shadow?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/** White surface card: soft shadow, hairline border, 18–20px radius. */
export function KayaCard({
  children,
  padding = spacing.lg,
  onPress,
  radius = radii.card,
  border = true,
  color = colors.surface,
  shadow = true,
  style,
  testID,
}: KayaCardProps) {
  const composed: ViewStyle = {
    padding,
    borderRadius: radius,
    backgroundColor: color,
    borderWidth: border ? 1 : 0,
    borderColor: border ? colors.borderSoft : undefined,
    ...(shadow ? shadows.card : { elevation: 0, shadowOpacity: 0 }),
  };

  if (onPress === undefined) {
    return (
      <View testID={testID} style={[styles.base, composed, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={[styles.base, composed, style]}>
      {children}
    </Pressable>
  );
}

// No `overflow: "hidden"` here: React Native maps it to `masksToBounds = YES`
// on iOS, which clips the layer's own shadow along with its content. The
// Dart original clipped nothing, and nothing in this package or its
// consumers relies on KayaCard clipping its children -- a caller that adds
// rounded-corner content needing a real clip (e.g. an image filling the
// card) should clip that child itself, not this shared shell.
const styles = StyleSheet.create({ base: {} });

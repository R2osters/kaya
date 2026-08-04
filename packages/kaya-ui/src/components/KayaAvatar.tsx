import { User } from "lucide-react-native";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export interface KayaAvatarProps {
  photoUrl?: string;
  name?: string;
  /** Diameter in pixels. The Dart original took a radius (default 24); this is its diameter equivalent. */
  size?: number;
  ring?: boolean;
  testID?: string;
}

const DEFAULT_SIZE = 48;
const RING_BORDER = 2;
const RING_PADDING = 2.5;

/**
 * First letter of the first word, plus the first letter of the last word when
 * there is more than one, uppercased. Whitespace-tolerant, ported from
 * kaya_avatar.dart's `_initials` getter.
 */
function initialsOf(name: string | undefined): string {
  const trimmed = (name ?? "").trim();
  if (trimmed === "") return "";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  if (parts.length === 1) return first.toUpperCase();
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

/** Circular avatar with graceful fallback to initials when no photo is set. */
export function KayaAvatar({ photoUrl, name, size = DEFAULT_SIZE, ring = false, testID }: KayaAvatarProps) {
  // An empty photo url counts as no photo, same as the Dart `photoUrl!.isNotEmpty` check.
  const hasPhoto = photoUrl !== undefined && photoUrl !== "";
  const initials = initialsOf(name);
  const circleSize = { width: size, height: size, borderRadius: size / 2 };

  let content;
  if (hasPhoto) {
    content = (
      <Image
        testID={testID ? `${testID}-image` : undefined}
        source={{ uri: photoUrl }}
        style={[styles.circle, circleSize]}
      />
    );
  } else if (initials === "") {
    content = (
      <View testID={testID ? `${testID}-placeholder` : undefined} style={[styles.circle, circleSize]}>
        <User color={colors.inkTertiary} size={size / 2} />
      </View>
    );
  } else {
    content = (
      <View style={[styles.circle, circleSize]}>
        <Text style={[styles.initials, { color: colors.inkSecondary, fontSize: size * 0.35 }]}>
          {initials}
        </Text>
      </View>
    );
  }

  if (!ring) {
    return <View testID={testID}>{content}</View>;
  }

  const ringSize = size + 2 * (RING_PADDING + RING_BORDER);
  return (
    <View
      testID={testID}
      style={[
        styles.ring,
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          padding: RING_PADDING,
          borderWidth: RING_BORDER,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontWeight: "700" },
  ring: {
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

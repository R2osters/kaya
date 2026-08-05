import { Star, StarHalf } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../theme";

export interface RatingStarsProps {
  value: number;
  size?: number;
  onRate?: (value: number) => void;
  count?: number;
  testID?: string;
}

type StarKind = "filled" | "half" | "outline";

/**
 * Ported verbatim from rating_stars.dart, including its quirk: a star is
 * filled when `i < Math.round(value)`. Because `Math.round(4.5)` is 5, a
 * rating of exactly 4.5 fills all five stars for a count of 5 — the half-star
 * branch below can only ever fire for a fractional part strictly between .25
 * and .5 (e.g. 4.3), never for exactly .5. This is the behaviour the Flutter
 * widget has always had; changing it is a design decision, not a port one.
 */
function kindAt(i: number, value: number): StarKind {
  const filled = i < Math.round(value);
  if (filled) return "filled";
  const half = i < value && value - i >= 0.25;
  return half ? "half" : "outline";
}

/** Amber star rating. Read-only by default; pass `onRate` for interactive input. */
export function RatingStars({ value, size = 18, onRate, count = 5, testID }: RatingStarsProps) {
  return (
    <View testID={testID} style={styles.row}>
      {Array.from({ length: count }, (_, i) => {
        const kind = kindAt(i, value);
        const color = kind === "outline" ? colors.inkTertiary : colors.amber;
        const icon = <StarGlyph kind={kind} size={size} color={color} />;
        // Always scoped to the row's own testID, never a bare "star-{i}".
        // Two rows on one screen — a delivery history listing several rated
        // trips, say — would otherwise both emit "star-0".."star-4" and make
        // getByTestId ambiguous. Falling back to the bare form for a row
        // without a testID would leave that collision reachable by default,
        // so a row that wants addressable stars has to name itself.
        const starTestID = testID === undefined ? undefined : `${testID}-star-${i}`;

        if (onRate === undefined) {
          return (
            <View key={i} testID={starTestID} accessibilityLabel={kind}>
              {icon}
            </View>
          );
        }
        return (
          <Pressable
            key={i}
            testID={starTestID}
            accessibilityLabel={kind}
            accessibilityRole="button"
            style={styles.pressable}
            onPress={() => onRate(i + 1)}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

function StarGlyph({ kind, size, color }: { kind: StarKind; size: number; color: string }) {
  if (kind === "half") {
    // lucide has no single "half filled star" glyph: layer the plain outline
    // with the half-fill shape on top, mirroring Icons.star_half_rounded.
    return (
      <View style={{ width: size, height: size }}>
        <Star size={size} color={color} fill="none" style={StyleSheet.absoluteFill} />
        <StarHalf size={size} color={color} fill={color} style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  return <Star size={size} color={color} fill={kind === "filled" ? color : "none"} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  pressable: { paddingHorizontal: 2 },
});

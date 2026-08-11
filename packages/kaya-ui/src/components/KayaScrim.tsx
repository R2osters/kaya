import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../theme";

export interface KayaScrimProps {
  /** Which edge the scrim fades from. */
  edge?: "top" | "bottom";
  /**
   * Peak opacity at the edge. 0.9 carries ink text over the busiest map tile;
   * lower reads as a hint rather than a backing.
   */
  strength?: number;
  /** Scrim height in px. The fade always spans the full height. */
  height?: number;
  testID?: string;
}

/**
 * A soft fade from the app background over imagery, so text laid on a map or
 * a photo stays legible whatever happens to be underneath it.
 *
 * Ink on raw map tiles works until the tile is busy -- a road label under a
 * heading destroys both. The rule (borrowed from how Apple treats text over
 * changing backgrounds) is that floating text never trusts its backdrop: it
 * brings its own. Built on react-native-svg, which the design system already
 * depends on, rather than adding a native gradient module.
 *
 * Absolutely positioned; place it between the image and the text:
 *
 *   <MapView … />
 *   <KayaScrim edge="top" height={140} />
 *   <Text>…</Text>
 */
export function KayaScrim({ edge = "top", strength = 0.9, height = 140, testID }: KayaScrimProps) {
  const stops =
    edge === "top"
      ? { from: strength, to: 0 }
      : { from: 0, to: strength };

  return (
    <Svg
      testID={testID}
      style={[styles.fill, edge === "top" ? styles.top : styles.bottom, { height }]}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="kaya-scrim" x1="0" y1="0" x2="0" y2="1">
          {/* The mid stop bends the ramp toward the edge so the fade reads as
              atmosphere, not as a hard band with a soft border. */}
          <Stop offset="0" stopColor={colors.background} stopOpacity={stops.from} />
          <Stop offset="0.6" stopColor={colors.background} stopOpacity={(stops.from + stops.to) / 4} />
          <Stop offset="1" stopColor={colors.background} stopOpacity={stops.to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#kaya-scrim)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", left: 0, right: 0 },
  top: { top: 0 },
  bottom: { bottom: 0 },
});

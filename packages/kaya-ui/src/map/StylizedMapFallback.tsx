import type { GeoPoint } from "@kaya/core";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors } from "../theme";
import type { MapMarker, MapViewProps } from "./MapView";

// A fixed logical canvas the SVG scales to fill its container (viewBox), so
// the pseudo-projection below stays deterministic regardless of the device's
// actual pixel size. The Dart original computed against the CustomPainter's
// `Size` at paint time instead, since Flutter's canvas gives you real pixel
// dimensions synchronously; React Native's layout does not, without a round
// trip through `onLayout`, so a fixed canvas is used here instead.
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 300;
const GRID_STEP = 46;

interface Point {
  x: number;
  y: number;
}

/**
 * Deterministic pseudo-projection: spreads a point across the canvas based on
 * its coordinates. This is a fallback-only visual, not a real geo projection
 * -- ported unchanged from map_view.dart's `_MapPainter._project`.
 */
function project(point: GeoPoint): Point {
  const fx = ((Math.abs(point.lng) * 1000) % 100) / 100;
  const fy = ((Math.abs(point.lat) * 1000) % 100) / 100;
  return {
    x: CANVAS_WIDTH * (0.2 + 0.6 * fx),
    y: CANVAS_HEIGHT * (0.25 + 0.45 * fy),
  };
}

function gridLines(): { key: string; x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let x = 0; x < CANVAS_WIDTH; x += GRID_STEP) {
    lines.push({ key: `v-${x}`, x1: x, y1: 0, x2: x, y2: CANVAS_HEIGHT });
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += GRID_STEP) {
    lines.push({ key: `h-${y}`, x1: 0, y1: y, x2: CANVAS_WIDTH, y2: y });
  }
  return lines;
}

function MarkerGlyph({ marker }: { marker: MapMarker }) {
  const { x, y } = project(marker.point);
  if (marker.isVehicle === true) {
    return (
      <>
        <Circle cx={x} cy={y} r={12} fill={marker.color} fillOpacity={0.25} />
        <Circle cx={x} cy={y} r={7} fill={marker.color} />
      </>
    );
  }
  return (
    <>
      <Circle cx={x} cy={y} r={9} fill={marker.color} />
      <Circle cx={x} cy={y} r={3.5} fill={colors.surface} />
    </>
  );
}

/**
 * Keyless placeholder map: a muted street grid, a water band and the
 * markers, so tracking/order screens still look right without a maps SDK or
 * API key. Rendered by `MapView` whenever the host app has not called
 * `registerMapProvider` -- see MapView.tsx. Ported from map_view.dart's
 * `StylizedMapFallback` / `_MapPainter`.
 *
 * `route` and `center` are accepted (part of `MapViewProps`) but, like the
 * Dart original, are not drawn here: the fallback approximates a connecting
 * line between the first and last marker instead, since it has no real tile
 * data to route against. `showUserLocation` is likewise not rendered --
 * there is no real position fix to show on a stylized canvas.
 */
export function StylizedMapFallback({ markers = [], testID }: MapViewProps) {
  const first = markers[0];
  const last = markers.length >= 2 ? markers[markers.length - 1] : undefined;

  return (
    <View testID={testID} style={styles.container}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
        <Defs>
          <LinearGradient id="fallback-bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.border} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#fallback-bg)" />

        {gridLines().map((line) => (
          <Line
            key={line.key}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={colors.surface}
            strokeWidth={2}
            strokeOpacity={0.6}
          />
        ))}

        {/* A representative water/coast band, like the reference Accra maps. */}
        <Path
          d={`M0,${CANVAS_HEIGHT * 0.82} L${CANVAS_WIDTH},${CANVAS_HEIGHT * 0.68} L${CANVAS_WIDTH},${CANVAS_HEIGHT} L0,${CANVAS_HEIGHT} Z`}
          fill={colors.primaryTint}
          fillOpacity={0.7}
        />

        {first !== undefined && last !== undefined && (
          <Line
            x1={project(first.point).x}
            y1={project(first.point).y}
            x2={project(last.point).x}
            y2={project(last.point).y}
            stroke={colors.primary}
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}

        {markers.map((marker, index) => (
          // eslint-disable-next-line react/no-array-index-key -- markers have no stable id in this contract
          <MarkerGlyph key={`marker-${index}`} marker={marker} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, overflow: "hidden" } });

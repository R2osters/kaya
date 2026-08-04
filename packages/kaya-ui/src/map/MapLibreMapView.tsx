import type { ComponentType, ReactNode } from "react";
import type { GeoPoint } from "@kaya/core";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import type { MapViewProps } from "./MapView";

/**
 * `@maplibre/maplibre-react-native` is a native module: merely importing it
 * throws with no native bridge linked -- the same failure PushAdapter.ts
 * documents for `@react-native-firebase/messaging` (see adapters/PushAdapter.ts).
 *
 * Unlike that adapter, this package is deliberately *not* added as an
 * `@kaya/ui` dependency yet. `@react-native-firebase/messaging` could be
 * installed safely because a real Expo config-plugin project already exists
 * to eventually link it against; the Expo app shells (`apps/client`,
 * `apps/driver`) that would do the same for maplibre don't exist until
 * phase 1C. Installing a large native map SDK now would sit in
 * package-lock.json unverified by anything in this repo -- nothing here can
 * build or link it, so a version mismatch or a broken peer dependency would
 * go unnoticed until 1C anyway. Phase 1C is also when the choice between
 * `@maplibre/maplibre-react-native`'s Expo config plugin and any New
 * Architecture caveats actually needs resolving, which is better done
 * against a real app target than speculatively here.
 *
 * So this file is written against a small local ambient type for the slice
 * of the maplibre-react-native JS surface it needs, and resolves the real
 * module lazily by name (the same `messaging()` pattern PushAdapter.ts
 * uses) so nothing here executes -- or needs the package installed -- until
 * a host app actually renders `<MapLibreMapView>`. That keeps this
 * component untouched by the "fallback and registry must work with no maps
 * SDK present" requirement: `MapView`/`StylizedMapFallback` never import or
 * render this file, so their tests need no mock for it either.
 *
 * Phase 1C's follow-up: add "@maplibre/maplibre-react-native" to
 * package.json, delete the `MaplibreModule` ambient type below, and switch
 * the `require` to a typed import -- the component body should not
 * otherwise need to change.
 */
declare function require(id: string): unknown;

interface MaplibreCameraProps {
  centerCoordinate: [number, number];
  zoomLevel?: number;
  animationDuration?: number;
}

interface MaplibreGeoJsonLineString {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

interface MaplibreModule {
  MapView: ComponentType<{ style?: unknown; mapStyle?: string; children?: ReactNode; testID?: string }>;
  Camera: ComponentType<MaplibreCameraProps>;
  PointAnnotation: ComponentType<{ id: string; coordinate: [number, number]; children?: ReactNode }>;
  ShapeSource: ComponentType<{ id: string; shape: MaplibreGeoJsonLineString; children?: ReactNode }>;
  LineLayer: ComponentType<{ id: string; style?: { lineColor?: string; lineWidth?: number } }>;
}

let cachedMaplibre: MaplibreModule | null = null;
function maplibre(): MaplibreModule {
  cachedMaplibre ??= require("@maplibre/maplibre-react-native") as MaplibreModule;
  return cachedMaplibre;
}

// Same public, no-key OpenStreetMap tile endpoint OsmMapView.dart used
// (legacy/flutter/client/lib/map/osm_map_view.dart), wrapped as a raster
// MapLibre style so no vector style URL (which would usually want its own
// key) is needed either.
const OSM_RASTER_STYLE = JSON.stringify({
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
});

// Matches OsmMapView.dart's Accra fallback centre, used when the caller
// supplies neither a center nor any markers to derive one from.
const ACCRA_FALLBACK: GeoPoint = { lat: 5.6037, lng: -0.187 };

function toLineString(points: GeoPoint[]): MaplibreGeoJsonLineString {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) },
  };
}

/**
 * Free, no-key map implementation on OpenStreetMap tiles via MapLibre. This
 * is the provider the host apps register by default via
 * `registerMapProvider` (see MapView.tsx); `react-native-maps` is registered
 * instead when `MAPS_API_KEY` is configured. Ported from
 * legacy/flutter/client/lib/map/osm_map_view.dart.
 */
export function MapLibreMapView({ center, markers = [], route, testID }: MapViewProps) {
  const { MapView: NativeMapView, Camera, PointAnnotation, ShapeSource, LineLayer } = maplibre();
  const focus = center ?? markers[0]?.point ?? ACCRA_FALLBACK;

  return (
    <NativeMapView testID={testID} style={styles.map} mapStyle={OSM_RASTER_STYLE}>
      <Camera centerCoordinate={[focus.lng, focus.lat]} zoomLevel={13} />

      {route !== undefined && route.length >= 2 && (
        <ShapeSource id="route" shape={toLineString(route)}>
          <LineLayer id="route-line" style={{ lineColor: colors.primary, lineWidth: 4 }} />
        </ShapeSource>
      )}

      {markers.map((marker, index) => (
        <PointAnnotation
          // eslint-disable-next-line react/no-array-index-key -- markers have no stable id in this contract
          key={`marker-${index}`}
          id={`marker-${index}`}
          coordinate={[marker.point.lng, marker.point.lat]}
        >
          <View style={[styles.markerDot, { backgroundColor: marker.color }, marker.isVehicle === true && styles.vehicleDot]} />
        </PointAnnotation>
      ))}
    </NativeMapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  markerDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.surface },
  vehicleDot: { width: 24, height: 24, borderRadius: 12 },
});

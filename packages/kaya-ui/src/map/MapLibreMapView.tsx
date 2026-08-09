import type { GeoPoint } from "@kaya/core";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import type { MapViewProps } from "./MapView";

/**
 * `@maplibre/maplibre-react-native` is a native module: merely importing it
 * throws with no native bridge linked -- the same failure PushAdapter.ts
 * documents for `@react-native-firebase/messaging` (see adapters/PushAdapter.ts).
 * So the module is still resolved lazily, by name, and nothing here executes
 * until a host app actually renders `<MapLibreMapView>`. That is what keeps
 * `MapView`/`StylizedMapFallback` (and their tests) working with no maps SDK
 * present at all.
 *
 * What changed in phase 1C: the package is now a real dependency of this
 * package, so the hand-written ambient interface this file used to be typed
 * against is gone, replaced by `typeof import(...)` -- a type-only construct
 * that emits no runtime import but does resolve against the installed
 * package's own `.d.ts`. The compiler now checks every prop below.
 *
 * That check immediately caught five wrong names the ambient type had been
 * asserting since phase 1B, none of which anything could detect while the
 * interface was hand-written. Against v11.3.6 the real API is:
 *
 *   ambient (wrong)                    real v11
 *   ---------------------------------- ------------------------------------
 *   MapView                            Map
 *   Camera centerCoordinate= zoomLevel= Camera center= zoom=
 *   PointAnnotation coordinate=        Marker lngLat=
 *   ShapeSource shape=                 GeoJSONSource data=
 *   LineLayer style={{lineColor}}      Layer type="line" paint={{"line-color"}}
 *
 * `mapStyle` was the only prop the ambient type got right. Rendered as written
 * before, the map would have thrown on the first unresolved component -- and
 * `MapView`'s own tests would still have passed, because they exercise the
 * registry and the fallback, never this file.
 */
declare function require(id: string): unknown;

type MaplibreModule = typeof import("@maplibre/maplibre-react-native");

let cachedMaplibre: MaplibreModule | null = null;
function maplibre(): MaplibreModule {
  cachedMaplibre ??= require("@maplibre/maplibre-react-native") as MaplibreModule;
  return cachedMaplibre;
}

/**
 * Same public, no-key OpenStreetMap tile endpoint OsmMapView.dart used
 * (legacy/flutter/client/lib/map/osm_map_view.dart), wrapped as a raster
 * MapLibre style so no vector style URL (which would usually want its own key)
 * is needed either.
 *
 * This is the dev/demo default, and it is deliberately not the production
 * answer: openstreetmap.org's tile usage policy does not cover a commercial
 * app's traffic. `styleUrl` below is the seam for a real tile source -- a
 * MapTiler style URL, or a self-hosted Protomaps extract of Ghana/Togo/Benin,
 * which is the cheaper option at Kaya's scale since it costs no per-request
 * fee and ships as a single file.
 */
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

const ROUTE_SOURCE_ID = "kaya-route";

export interface MapLibreMapViewProps extends MapViewProps {
  /**
   * A MapLibre style URL (or style JSON) to render instead of the keyless OSM
   * raster default. Host apps pass one through the closure they hand to
   * `registerMapProvider`; see apps/*\/src/map/register.ts.
   */
  styleUrl?: string;
}

function toLineString(points: GeoPoint[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) },
  };
}

/**
 * Free, no-key map implementation on OpenStreetMap tiles via MapLibre. This is
 * the provider the host apps register by default via `registerMapProvider`
 * (see MapView.tsx). Ported from
 * legacy/flutter/client/lib/map/osm_map_view.dart.
 */
export function MapLibreMapView({
  center,
  markers = [],
  route,
  showUserLocation,
  styleUrl,
  testID,
}: MapLibreMapViewProps) {
  const { Map, Camera, Marker, GeoJSONSource, Layer, UserLocation } = maplibre();
  const focus = center ?? markers[0]?.point ?? ACCRA_FALLBACK;

  return (
    <Map testID={testID} style={styles.map} mapStyle={styleUrl ?? OSM_RASTER_STYLE}>
      <Camera center={[focus.lng, focus.lat]} zoom={13} />

      {showUserLocation === true && <UserLocation />}

      {route !== undefined && route.length >= 2 && (
        <GeoJSONSource id={ROUTE_SOURCE_ID} data={toLineString(route)}>
          {/* `paint` with style-spec keys, not the deprecated `style` prop --
              maplibre-react-native removes `style` in v12. */}
          <Layer
            id="kaya-route-line"
            type="line"
            source={ROUTE_SOURCE_ID}
            paint={{ "line-color": colors.primary, "line-width": 4 }}
          />
        </GeoJSONSource>
      )}

      {markers.map((marker, index) => (
        <Marker
          // markers have no stable id in this contract, so the index is the key.
          key={`marker-${index}`}
          id={`marker-${index}`}
          lngLat={[marker.point.lng, marker.point.lat]}
        >
          <View
            style={[
              styles.markerDot,
              { backgroundColor: marker.color },
              marker.isVehicle === true && styles.vehicleDot,
            ]}
          />
        </Marker>
      ))}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  markerDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.surface },
  vehicleDot: { width: 24, height: 24, borderRadius: 12 },
});

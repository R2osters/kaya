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
 * Padding around a fitted box, as a fraction of its own span, so pins do not
 * sit against the edge of the view. 15% on each side.
 */
const BOUNDS_PADDING_RATIO = 0.15;

/**
 * Smallest span a fitted box may have, in degrees (~1.1 km of latitude).
 *
 * Without a floor, two points a few metres apart -- a driver who has just
 * arrived at the pickup -- produce a near-zero box and the camera zooms to
 * street furniture. This keeps a degenerate box readable.
 */
const MIN_BOUNDS_SPAN_DEG = 0.01;

/**
 * The box containing every supplied point, in MapLibre's [west, south, east,
 * north] order.
 *
 * Returns null for fewer than two points: one point is a `center`, not a box,
 * and the caller falls back to centre-and-zoom.
 */
function boundsOf(points: GeoPoint[]): [number, number, number, number] | null {
  if (points.length < 2) return null;

  let west = points[0]!.lng;
  let east = points[0]!.lng;
  let south = points[0]!.lat;
  let north = points[0]!.lat;

  for (const point of points) {
    if (point.lng < west) west = point.lng;
    if (point.lng > east) east = point.lng;
    if (point.lat < south) south = point.lat;
    if (point.lat > north) north = point.lat;
  }

  const lngPad = Math.max((east - west) * BOUNDS_PADDING_RATIO, MIN_BOUNDS_SPAN_DEG / 2);
  const latPad = Math.max((north - south) * BOUNDS_PADDING_RATIO, MIN_BOUNDS_SPAN_DEG / 2);

  return [west - lngPad, south - latPad, east + lngPad, north + latPad];
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

  // An explicit `center` is the caller being specific and always wins. With
  // none, everything the map is being asked to show is fitted into view.
  //
  // Verified on a device, which is what prompted this: the showcase passes a
  // pickup, a dropoff and a vehicle spread over ~6 km, and a fixed zoom 13
  // centred on the first marker rendered exactly one pin -- the other two sat
  // outside the viewport with nothing to suggest they existed. On a tracking
  // screen that is the whole screen being wrong: the point of it is seeing the
  // driver relative to the destination.
  const fitted = center === undefined ? boundsOf([...markers.map((m) => m.point), ...(route ?? [])]) : null;
  const focus = center ?? markers[0]?.point ?? ACCRA_FALLBACK;

  return (
    <Map testID={testID} style={styles.map} mapStyle={styleUrl ?? OSM_RASTER_STYLE}>
      {fitted === null ? (
        <Camera center={[focus.lng, focus.lat]} zoom={13} />
      ) : (
        <Camera bounds={fitted} />
      )}

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

/**
 * Exported for tests only. The component itself cannot be rendered under Jest
 * -- it resolves a native module -- but `boundsOf` is pure arithmetic and is
 * where the interesting mistakes live (an inverted axis, a degenerate box, an
 * off-by-one on the two-point threshold).
 */
export const __testing = { boundsOf, MIN_BOUNDS_SPAN_DEG, BOUNDS_PADDING_RATIO };

const styles = StyleSheet.create({
  map: { flex: 1 },
  markerDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.surface },
  vehicleDot: { width: 24, height: 24, borderRadius: 12 },
});

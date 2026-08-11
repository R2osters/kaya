import type { ComponentType } from "react";
import type { GeoPoint } from "@kaya/core";
import { colors } from "../theme";
import { StylizedMapFallback } from "./StylizedMapFallback";

/**
 * A marker to draw on the map. Ported from map_view.dart's `MapMarker` --
 * `color` stays a plain string (not a themed token type) because concrete
 * providers (MapLibre, react-native-maps) consume it as a raw hex string.
 */
export interface MapMarker {
  point: GeoPoint;
  color: string;
  label?: string;
  isVehicle?: boolean;
}

/** Green pickup marker, matching `colors.markerPickup`. */
export function pickupMarker(point: GeoPoint, label?: string): MapMarker {
  return { point, color: colors.markerPickup, label };
}

/** Blue drop-off marker, matching `colors.markerDropoff`. */
export function dropoffMarker(point: GeoPoint, label?: string): MapMarker {
  return { point, color: colors.markerDropoff, label };
}

/** Driver/vehicle position marker -- primary tint, rendered larger by providers. */
export function vehicleMarker(point: GeoPoint): MapMarker {
  return { point, color: colors.primary, isVehicle: true };
}

export interface MapViewProps {
  center?: GeoPoint;
  markers?: MapMarker[];
  route?: GeoPoint[];
  showUserLocation?: boolean;
  /**
   * Which country's city the map opens on when it has nothing else to go by --
   * no explicit centre, no markers, no route.
   *
   * Kaya operates in three countries and every map used to fall back to one
   * hardcoded Accra coordinate, so a driver in Lomé or Cotonou opened their
   * home screen on a city 500 km away and had to drag before it said anything.
   * The tiles were never the problem (the style is global); the camera was.
   * Callers pass the signed-in user's `countryCode`.
   */
  countryCode?: string;
  testID?: string;
}

/** The shape a concrete map implementation must satisfy to be registered. */
export type MapProviderComponent = ComponentType<MapViewProps>;

// Host-app registration, module-level -- mirrors the Dart original's static
// `MapView.factory` field (legacy/flutter/kaya_core/lib/src/map/map_view.dart).
// There is deliberately only one slot: registering a second provider replaces
// the first rather than accumulating a list, since an app only ever wants one
// active map implementation at a time.
let registeredProvider: MapProviderComponent | null = null;

/**
 * Host apps call this once at startup to plug in a concrete map
 * implementation -- `MapLibreMapView` by default, or a `react-native-maps`
 * implementation when `MAPS_API_KEY` is configured. Calling it again replaces
 * the previous registration; it does not stack providers.
 */
export function registerMapProvider(provider: MapProviderComponent): void {
  registeredProvider = provider;
}

/** Whether a concrete provider has been registered. */
export function hasMapProvider(): boolean {
  return registeredProvider !== null;
}

/**
 * Clears the registration, so `MapView` renders the stylized fallback again.
 *
 * This exists for tests. The registry is module-level state, so a test that
 * registers a provider leaks it into every later test in the same module
 * registry -- and the only tool available before this function was
 * `jest.resetModules()`, which throws away the whole module graph to reset one
 * variable, and silently breaks any assertion that compares against an
 * identity imported before the reset. Every app test that touched a map was
 * carrying that workaround.
 *
 * It is not app API: a running app registers exactly one provider at startup
 * and never unregisters it.
 */
export function resetMapProvider(): void {
  registeredProvider = null;
}

/**
 * Map abstraction: renders whatever provider the host app registered via
 * `registerMapProvider`, or a stylized keyless fallback when nothing is
 * registered. This is what keeps `@kaya/ui` itself free of any maps SDK
 * dependency, and keeps both apps fully usable in dev and demos with no API
 * key at all. Ported from map_view.dart's abstract `MapView` widget --
 * `registeredProvider` here is the direct equivalent of its static `factory`.
 */
export function MapView(props: MapViewProps) {
  if (registeredProvider !== null) {
    const Provider = registeredProvider;
    return <Provider {...props} />;
  }
  return <StylizedMapFallback {...props} />;
}

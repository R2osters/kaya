import { MapLibreMapView, registerMapProvider, type MapViewProps } from "@kaya/ui";
import { env } from "../config/env";

/**
 * MapTiler's hosted streets style, the keyed tile source `env.mapsApiKey`
 * selects. Any MapLibre style URL works here; this one is a documented
 * free-tier starting point with commercial terms, unlike the keyless OSM
 * raster default (see below).
 */
function keyedStyleUrl(apiKey: string): string {
  return `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(apiKey)}`;
}

/**
 * Registers the app's concrete map implementation, once, at startup.
 *
 * **Deviation from the phase 1C plan, recorded in BLUEPRINT.md's decisions
 * log.** The plan said the key selects between MapLibre and `react-native-maps`.
 * It selects a *tile source* for MapLibre instead, and the SDK stays the same
 * either way, because the thing a key actually buys is tiles: MapLibre renders
 * any style URL, so a second native map SDK (plus Google Maps billing, plus a
 * second set of native build problems) would buy nothing the style URL does
 * not already give.
 *
 * With no key the keyless OpenStreetMap raster style in `MapLibreMapView`
 * applies, which keeps both apps fully usable in dev and demos with no account
 * anywhere. That default is explicitly not the production answer:
 * openstreetmap.org's tile usage policy does not cover a commercial app's
 * traffic. Production sets a key, or points `keyedStyleUrl` at a self-hosted
 * Protomaps extract of Ghana/Togo/Benin -- one file, no per-request cost,
 * which at Kaya's traffic on West African mobile data is the cheaper answer.
 *
 * Safe to call more than once: the registry holds a single slot and a second
 * registration replaces the first rather than stacking.
 */
export function registerAppMapProvider(): void {
  const styleUrl = env.mapsApiKey === null ? undefined : keyedStyleUrl(env.mapsApiKey);

  registerMapProvider(function AppMapProvider(props: MapViewProps) {
    return <MapLibreMapView {...props} styleUrl={styleUrl} />;
  });
}

/** Exported for the tests; not app API. */
export const __testing = { keyedStyleUrl };

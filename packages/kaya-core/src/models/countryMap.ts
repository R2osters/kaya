import { COUNTRY_CODES, type CountryCode } from "../money/currency";
import type { GeoPoint } from "./geo";

/** Where a map opens for a country, and how tightly. */
export interface CountryMapDefaults {
  /** The city the platform actually operates in, not the country's centroid. */
  readonly center: GeoPoint;
  /**
   * Opening zoom. City-level (12) rather than country-level: a driver opening
   * their map wants to see streets they recognise, and a map that opens on a
   * whole country has to be dragged before it says anything.
   */
  readonly zoom: number;
  /** The city's own name, for a label or an empty-state line. */
  readonly cityName: string;
}

/**
 * Per-country map defaults.
 *
 * Every map in both apps used to fall back to one hardcoded Accra coordinate,
 * so a driver in Lomé or Cotonou opened their home screen on a city 500 km
 * away and had to drag the map before it told them anything. The tiles were
 * never the problem -- the style is global -- the *camera* was.
 *
 * Each centre is the commercial centre of the city the platform launches in,
 * chosen so the first screenful contains real streets rather than a coastline
 * or a national border:
 *
 *  - Ghana: Accra, around Kwame Nkrumah Circle.
 *  - Togo: Lomé, around the Grand Marché.
 *  - Benin: Cotonou, around Étoile Rouge. (Porto-Novo is the capital; Cotonou
 *    is where the deliveries are.)
 */
export const COUNTRY_MAP_DEFAULTS: Record<CountryCode, CountryMapDefaults> = Object.freeze({
  GHA: Object.freeze({
    center: Object.freeze({ lat: 5.6037, lng: -0.187 }),
    zoom: 12,
    cityName: "Accra",
  }),
  TGO: Object.freeze({
    center: Object.freeze({ lat: 6.1319, lng: 1.2228 }),
    zoom: 12,
    cityName: "Lomé",
  }),
  BEN: Object.freeze({
    center: Object.freeze({ lat: 6.3654, lng: 2.4183 }),
    zoom: 12,
    cityName: "Cotonou",
  }),
});

/**
 * Where a map should open for this user.
 *
 * Falls back to Ghana for an unknown or absent country rather than throwing:
 * a map that renders somewhere plausible is recoverable, and the caller
 * usually has a real position arriving a second later anyway.
 */
export function mapDefaultsFor(countryCode: string | null | undefined): CountryMapDefaults {
  const known = (COUNTRY_CODES as readonly string[]).includes(countryCode ?? "");
  return COUNTRY_MAP_DEFAULTS[known ? (countryCode as CountryCode) : "GHA"];
}

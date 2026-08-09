/** Injection token for the active geocoding provider. */
export const GEOCODING_PROVIDER = 'GEOCODING_PROVIDER';

/** ISO 3166-1 alpha-2 codes for the three launch countries. */
export const SUPPORTED_COUNTRY_CODES = ['GH', 'TG', 'BJ'] as const;
export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

/**
 * Maps the platform's own three-letter country codes (CountryCode in Prisma,
 * `country_configs.country_code`) onto the two-letter codes every geocoding
 * API speaks. Kept here rather than inline so a fourth country is one line.
 */
export const COUNTRY_CODE_ALPHA2: Record<string, SupportedCountryCode> = {
  GHA: 'GH',
  TGO: 'TG',
  BEN: 'BJ',
};

export interface GeocodeSuggestion {
  /**
   * What the user sees in the list: the place name plus enough context to tell
   * two identically-named places apart ("Osu, Accra, Ghana").
   */
  label: string;
  /** The place's own name, without the context suffix. */
  name: string;
  /** City or town, when the source knows one. */
  city: string | null;
  /** Two-letter country code, when the source knows one. */
  countryCode: string | null;
  lat: number;
  lng: number;
}

export interface GeocodeQuery {
  /** Raw user input. Partial by nature -- this backs a type-ahead field. */
  text: string;
  /**
   * Restricts results to one country. The apps always pass this: an unfiltered
   * search for "Accra" returns places on three continents, and a delivery
   * platform whose price depends on distance cannot afford a drop-off pin in
   * the wrong hemisphere.
   */
  countryCode?: SupportedCountryCode;
  /** UI language for the returned labels; "fr" or "en" (the app's two). */
  language?: string;
  /** Hard cap on results. Providers clamp their own maximum. */
  limit?: number;
}

/**
 * Turns partial address text into coordinates.
 *
 * `/create-order` cannot exist without this: the price is
 * `distance_km × price_per_km + base_pickup_fee`, distance needs two
 * GeoPoints, and a user types an address rather than a latitude.
 *
 * Swappable for the same reason DistanceProvider is: address coverage in
 * Ghana, Togo and Benin varies enormously between sources, and the right one
 * is an empirical question per country -- not a dependency to bake in. It also
 * keeps the platform running with no account anywhere, per the project rule
 * that every external integration has a mock/sandbox implementation usable
 * without a key.
 */
export interface GeocodingProvider {
  readonly name: string;
  search(query: GeocodeQuery): Promise<GeocodeSuggestion[]>;
}

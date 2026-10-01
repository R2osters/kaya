import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import {
  GeocodeQuery,
  GeocodeSuggestion,
  GeocodingProvider,
  ReverseGeocodeQuery,
} from '../geocoding-provider.interface';
import { StaticGeocodingProvider } from './static.provider';

/**
 * Photon (Komoot) geocoder, over OpenStreetMap data.
 *
 * Chosen over Nominatim, the other keyless OSM geocoder, for one reason that
 * decides it: Nominatim's usage policy forbids auto-complete queries and caps
 * traffic at one request per second. This endpoint backs a type-ahead field,
 * which is exactly the pattern Photon is built for and exactly the pattern
 * Nominatim prohibits. Verified against the launch cities before being wired
 * in -- "Osu Accra" with `lang=fr` returns Osu / Accra / Ghana / GH correctly.
 *
 * The public instance needs no key, which is what makes it the right default:
 * a checkout of this repo can search addresses with no account anywhere. It is
 * not the production answer -- no SLA, no commercial guarantee -- and
 * `GEOCODING_PROVIDER=static` or a keyed provider (Geoapify, LocationIQ,
 * OpenCage; all OSM-backed with commercial free tiers) replaces it via
 * `PHOTON_BASE_URL` pointing at a self-hosted instance, or a new class behind
 * this same interface.
 *
 * Known coverage gap, not solvable by swapping providers: in Ghana the
 * addressing scheme people actually use is GhanaPostGPS digital addresses
 * ("GA-183-2731"), and OSM's coverage of peri-urban Accra is thin. Whatever
 * screen consumes this will need a second input for a digital address, plus
 * the ability to drop a pin. That is a phase 2 design problem; this interface
 * does not prevent it.
 *
 * A failure degrades to the static provider rather than throwing. An address
 * search that returns the seeded landmarks is a usable screen; one that
 * 500s is a dead end in the middle of creating an order.
 */
@Injectable()
export class PhotonProvider implements GeocodingProvider {
  readonly name = 'photon';
  private readonly logger = new Logger(PhotonProvider.name);

  private static readonly TIMEOUT_MS = 4_000;
  /** Long enough for a list, short enough not to bury the good matches. */
  private static readonly MAX_LIMIT = 10;

  constructor(
    private readonly config: AppConfigService,
    private readonly fallback: StaticGeocodingProvider,
  ) {}

  async search(query: GeocodeQuery): Promise<GeocodeSuggestion[]> {
    const text = query.text.trim();
    // One or two characters match half a country and cost a round trip to
    // learn nothing. The screen shows recent addresses until this passes.
    if (text.length < 3) return [];

    const baseUrl = this.config.get('PHOTON_BASE_URL').replace(/\/+$/, '');

    try {
      const url = new URL(`${baseUrl}/api/`);
      url.searchParams.set('q', text);
      url.searchParams.set('limit', String(Math.min(query.limit ?? 5, PhotonProvider.MAX_LIMIT)));
      if (query.language) url.searchParams.set('lang', query.language);
      if (query.countryCode) {
        // Photon spells this filter `osm_tag`-free: the country restriction is
        // a bbox-less `countrycodes`-style param on some builds and absent on
        // others, so the country is enforced below on the parsed results as
        // well. Sending it is still worth it -- it improves ranking even where
        // it is not enforced server-side.
        url.searchParams.set('countrycodes', query.countryCode.toLowerCase());
      }

      const res = await fetch(url, {
        signal: AbortSignal.timeout(PhotonProvider.TIMEOUT_MS),
        headers: { 'User-Agent': 'kaya-backend' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = (await res.json()) as PhotonResponse;
      const features = Array.isArray(body.features) ? body.features : [];

      return features
        .map((feature) => toSuggestion(feature))
        .filter((s): s is GeocodeSuggestion => s !== null)
        .filter(
          (s) =>
            query.countryCode === undefined ||
            s.countryCode === null ||
            s.countryCode === query.countryCode,
        );
    } catch (err) {
      this.logger.warn(
        `Photon geocoding failed (${(err as Error).message}); using the static provider.`,
      );
      return this.fallback.search(query);
    }
  }

  /**
   * Photon's `/reverse` endpoint. Backs "use my position" in the apps.
   *
   * Degrades the same way `search` does, and for the same reason: a user who
   * tapped a button to save themselves typing gets the nearest seeded landmark
   * instead of an error in the middle of creating an order.
   */
  async reverse(query: ReverseGeocodeQuery): Promise<GeocodeSuggestion | null> {
    const baseUrl = this.config.get('PHOTON_BASE_URL').replace(/\/+$/, '');

    try {
      const url = new URL(`${baseUrl}/reverse`);
      url.searchParams.set('lat', String(query.lat));
      url.searchParams.set('lon', String(query.lng));
      url.searchParams.set('limit', '1');
      if (query.language) url.searchParams.set('lang', query.language);

      const res = await fetch(url, {
        signal: AbortSignal.timeout(PhotonProvider.TIMEOUT_MS),
        headers: { 'User-Agent': 'kaya-backend' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = (await res.json()) as PhotonResponse;
      const feature = (Array.isArray(body.features) ? body.features : [])[0];
      if (feature === undefined) return null;

      const suggestion = toSuggestion(feature);
      if (suggestion === null) return null;
      // The requested position is what the order is priced and routed from;
      // the address is a label for it. Photon answers with the matched
      // feature's own centroid, which for a large feature (a whole
      // neighbourhood) can sit hundreds of metres from where the user is
      // standing -- and that difference would silently become the pickup pin.
      return { ...suggestion, lat: query.lat, lng: query.lng };
    } catch (err) {
      this.logger.warn(
        `Photon reverse geocoding failed (${(err as Error).message}); using the static provider.`,
      );
      return this.fallback.reverse(query);
    }
  }
}

/**
 * Photon returns GeoJSON, so coordinates arrive as [lng, lat] -- the reverse
 * of every GeoPoint in this platform. A feature missing either coordinate is
 * dropped rather than defaulted: a suggestion with a wrong pin prices a
 * delivery wrongly and nobody sees why.
 */
function toSuggestion(feature: PhotonFeature): GeocodeSuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  const lng = coordinates?.[0];
  const lat = coordinates?.[1];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const props = feature.properties ?? {};
  const name = typeof props.name === 'string' ? props.name : null;
  if (name === null || name === '') return null;

  const city = typeof props.city === 'string' ? props.city : null;
  const state = typeof props.state === 'string' ? props.state : null;
  const country = typeof props.country === 'string' ? props.country : null;
  const countryCode =
    typeof props.countrycode === 'string' ? props.countrycode.toUpperCase() : null;

  // City before state before country, deduplicated: "Osu, Accra, Ghana", not
  // "Osu, Accra, Greater Accra Region, Ghana", and not "Accra, Accra, Ghana"
  // for a result whose own name is the city.
  const parts = [name, city, state, country].filter(
    (part): part is string => part !== null && part !== '',
  );
  const label = [...new Set(parts)].slice(0, 3).join(', ');

  return { label, name, city, countryCode, lat, lng };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: {
    name?: unknown;
    city?: unknown;
    state?: unknown;
    country?: unknown;
    countrycode?: unknown;
  };
}

import { Injectable } from '@nestjs/common';
import {
  GeocodeQuery,
  GeocodeSuggestion,
  GeocodingProvider,
  ReverseGeocodeQuery,
} from '../geocoding-provider.interface';

/**
 * A fixed list of landmarks across the three launch cities, matched by
 * substring. No network, no key, no account.
 *
 * This is the mock implementation the project rule requires of every external
 * integration, and it is not only for tests: it is what PhotonProvider falls
 * back to when the geocoder is unreachable. An address search that returns a
 * short list of real landmarks lets someone finish creating an order; one that
 * 500s is a dead end halfway through.
 *
 * The coordinates are real, so a quote built from them is a plausible quote.
 * The list is short on purpose -- it is a fallback and a fixture, not a
 * gazetteer.
 */
const LANDMARKS: GeocodeSuggestion[] = [
  // Ghana -- Accra and Tema
  {
    label: 'Osu, Accra, Ghana',
    name: 'Osu',
    city: 'Accra',
    countryCode: 'GH',
    lat: 5.5606,
    lng: -0.1824,
  },
  {
    label: 'Accra Mall, Accra, Ghana',
    name: 'Accra Mall',
    city: 'Accra',
    countryCode: 'GH',
    lat: 5.6206,
    lng: -0.1725,
  },
  {
    label: 'Makola Market, Accra, Ghana',
    name: 'Makola Market',
    city: 'Accra',
    countryCode: 'GH',
    lat: 5.5479,
    lng: -0.2088,
  },
  {
    label: 'Kotoka International Airport, Accra, Ghana',
    name: 'Kotoka International Airport',
    city: 'Accra',
    countryCode: 'GH',
    lat: 5.6052,
    lng: -0.1668,
  },
  {
    label: 'East Legon, Accra, Ghana',
    name: 'East Legon',
    city: 'Accra',
    countryCode: 'GH',
    lat: 5.6353,
    lng: -0.1608,
  },
  {
    label: 'Tema Station, Tema, Ghana',
    name: 'Tema Station',
    city: 'Tema',
    countryCode: 'GH',
    lat: 5.6698,
    lng: -0.0166,
  },
  {
    label: 'Kumasi Central Market, Kumasi, Ghana',
    name: 'Kumasi Central Market',
    city: 'Kumasi',
    countryCode: 'GH',
    lat: 6.6926,
    lng: -1.6244,
  },

  // Togo -- Lome
  {
    label: 'Grand Marche, Lome, Togo',
    name: 'Grand Marche',
    city: 'Lome',
    countryCode: 'TG',
    lat: 6.1319,
    lng: 1.2228,
  },
  {
    label: 'Baguida, Lome, Togo',
    name: 'Baguida',
    city: 'Lome',
    countryCode: 'TG',
    lat: 6.19,
    lng: 1.33,
  },
  {
    label: 'Aeroport International de Lome, Lome, Togo',
    name: 'Aeroport International de Lome',
    city: 'Lome',
    countryCode: 'TG',
    lat: 6.1656,
    lng: 1.2544,
  },
  {
    label: 'Universite de Lome, Lome, Togo',
    name: 'Universite de Lome',
    city: 'Lome',
    countryCode: 'TG',
    lat: 6.1746,
    lng: 1.2136,
  },

  // Benin -- Cotonou and Porto-Novo
  {
    label: 'Dantokpa Market, Cotonou, Benin',
    name: 'Dantokpa Market',
    city: 'Cotonou',
    countryCode: 'BJ',
    lat: 6.3654,
    lng: 2.4324,
  },
  {
    label: 'Cadjehoun Airport, Cotonou, Benin',
    name: 'Cadjehoun Airport',
    city: 'Cotonou',
    countryCode: 'BJ',
    lat: 6.3573,
    lng: 2.3844,
  },
  {
    label: 'Fidjrosse, Cotonou, Benin',
    name: 'Fidjrosse',
    city: 'Cotonou',
    countryCode: 'BJ',
    lat: 6.3549,
    lng: 2.3617,
  },
  {
    label: 'Porto-Novo, Benin',
    name: 'Porto-Novo',
    city: 'Porto-Novo',
    countryCode: 'BJ',
    lat: 6.4969,
    lng: 2.6289,
  },
];

/**
 * Strips accents and case so "Aeroport", "aéroport" and "AÉROPORT" all match
 * the same entry. Users type on a phone keyboard in two languages; requiring
 * the right diacritic to find the airport would make the list look empty.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

@Injectable()
export class StaticGeocodingProvider implements GeocodingProvider {
  readonly name = 'static';

  search(query: GeocodeQuery): Promise<GeocodeSuggestion[]> {
    const text = normalize(query.text);
    if (text.length < 2) return Promise.resolve([]);

    const matches = LANDMARKS.filter((entry) => {
      if (query.countryCode !== undefined && entry.countryCode !== query.countryCode) {
        return false;
      }
      return normalize(entry.name).includes(text) || normalize(entry.label).includes(text);
    });

    return Promise.resolve(matches.slice(0, query.limit ?? 5));
  }

  /**
   * The nearest seeded landmark, with the caller's own coordinate kept.
   *
   * Deliberately not "the landmark's position": this backs "use my position",
   * and the position is the whole point -- the label is context a driver reads
   * ("near Osu"). Returning the landmark's coordinate instead would move a
   * pickup pin kilometres from where the user is standing and price the
   * delivery from there.
   *
   * Resolves null past MAX_LANDMARK_KM. A label saying "Osu, Accra" for
   * someone in Kumasi is worse than no label: the driver reads it, and it is
   * a lie.
   */
  reverse(query: ReverseGeocodeQuery): Promise<GeocodeSuggestion | null> {
    let best: GeocodeSuggestion | null = null;
    let bestKm = Number.POSITIVE_INFINITY;

    for (const entry of LANDMARKS) {
      const km = haversineKm(query.lat, query.lng, entry.lat, entry.lng);
      if (km < bestKm) {
        bestKm = km;
        best = entry;
      }
    }

    if (best === null || bestKm > MAX_LANDMARK_KM) return Promise.resolve(null);
    return Promise.resolve({ ...best, lat: query.lat, lng: query.lng });
  }
}

/**
 * How far a seeded landmark may be and still describe where someone is.
 *
 * 25 km covers a city and its suburbs -- Accra to Tema is about 25 km, which
 * is the longest run the launch cities produce. Past that the nearest landmark
 * is in a different place entirely.
 */
const MAX_LANDMARK_KM = 25;

/** Great-circle distance in kilometres. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

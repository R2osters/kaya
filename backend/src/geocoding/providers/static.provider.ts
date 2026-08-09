import { Injectable } from '@nestjs/common';
import {
  GeocodeQuery,
  GeocodeSuggestion,
  GeocodingProvider,
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
}

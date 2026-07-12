/** Injection token for the active distance provider. */
export const DISTANCE_PROVIDER = 'DISTANCE_PROVIDER';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanceKm: number;
  durationMin: number | null;
  source: string;
}

/**
 * Computes travel distance between two points. Implemented by a keyless
 * haversine provider (dev/default) and a Google Distance Matrix provider.
 * Swappable so pricing never depends on a specific maps vendor.
 */
export interface DistanceProvider {
  readonly name: string;
  distance(origin: LatLng, destination: LatLng): Promise<DistanceResult>;
}

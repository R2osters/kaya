import { Injectable } from '@nestjs/common';
import {
  DistanceProvider,
  DistanceResult,
  LatLng,
} from '../distance-provider.interface';

const EARTH_RADIUS_KM = 6371;
// Rough city-driving assumption used only for a dev duration estimate.
const AVERAGE_SPEED_KMH = 25;

/**
 * Keyless great-circle distance. Good enough for dev and as a production
 * fallback when the maps API is unavailable. Straight-line distance is inflated
 * slightly to approximate road distance.
 */
@Injectable()
export class HaversineProvider implements DistanceProvider {
  readonly name = 'haversine';
  // Multiplier approximating road distance vs. straight line.
  private static readonly ROAD_FACTOR = 1.3;

  async distance(origin: LatLng, destination: LatLng): Promise<DistanceResult> {
    const dLat = this.toRad(destination.lat - origin.lat);
    const dLng = this.toRad(destination.lng - origin.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(origin.lat)) *
        Math.cos(this.toRad(destination.lat)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = EARTH_RADIUS_KM * c;
    const distanceKm = straightKm * HaversineProvider.ROAD_FACTOR;

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMin: Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60),
      source: this.name,
    };
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}

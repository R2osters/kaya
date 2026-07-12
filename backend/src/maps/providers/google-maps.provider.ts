import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import {
  DistanceProvider,
  DistanceResult,
  LatLng,
} from '../distance-provider.interface';
import { HaversineProvider } from './haversine.provider';

/**
 * Google Distance Matrix provider. Falls back to haversine when no API key is
 * configured or the API errors, so the platform keeps working without a key.
 */
@Injectable()
export class GoogleMapsProvider implements DistanceProvider {
  readonly name = 'google';
  private readonly logger = new Logger(GoogleMapsProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly fallback: HaversineProvider,
  ) {}

  async distance(origin: LatLng, destination: LatLng): Promise<DistanceResult> {
    const apiKey = this.config.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return this.fallback.distance(origin, destination);
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
      url.searchParams.set('destinations', `${destination.lat},${destination.lng}`);
      url.searchParams.set('key', apiKey);

      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const body = (await res.json()) as GoogleDistanceMatrixResponse;
      const element = body.rows?.[0]?.elements?.[0];
      if (element?.status !== 'OK' || !element.distance) {
        throw new Error(`Distance Matrix status: ${element?.status ?? body.status}`);
      }

      return {
        distanceKm: Math.round((element.distance.value / 1000) * 100) / 100,
        durationMin: element.duration ? Math.round(element.duration.value / 60) : null,
        source: this.name,
      };
    } catch (err) {
      this.logger.warn(
        `Google Distance Matrix failed (${(err as Error).message}); using haversine fallback.`,
      );
      return this.fallback.distance(origin, destination);
    }
  }
}

interface GoogleDistanceMatrixResponse {
  status: string;
  rows?: Array<{
    elements?: Array<{
      status: string;
      distance?: { value: number };
      duration?: { value: number };
    }>;
  }>;
}

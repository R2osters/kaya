import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { DistanceProvider, DistanceResult, LatLng } from '../distance-provider.interface';
import { HaversineProvider } from './haversine.provider';

/**
 * Road distance from an OSRM routing server.
 *
 * Why this exists: the price of every delivery is `distance_km × price_per_km
 * + base_pickup_fee`, and until now `distance_km` came from a straight line
 * multiplied by a constant 1.3. Measured against real routes in the three
 * launch countries, that constant is wrong by up to 15% and the error changes
 * sign, so no better constant fixes it:
 *
 *   Accra -> Tema          haversine×1.3 26.31 km, road 22.94 km   +14.7%
 *   Osu -> Accra Mall      haversine×1.3  8.79 km, road  9.22 km    -4.7%
 *   Lome -> Baguida        haversine×1.3 17.55 km, road 17.48 km    +0.4%
 *
 * A route that crosses a lagoon, a river or a one-bridge corridor reads long;
 * a short dense-grid hop reads short. Whoever is on the wrong side of that
 * loses money on every delivery -- the client on the first row, the driver on
 * the second -- and neither can see why.
 *
 * `OSRM_BASE_URL` defaults to the public demo server, which answers without a
 * key and is the right default for dev. It is explicitly not the production
 * answer: the demo has no SLA and its usage policy does not cover a commercial
 * app. Production points this at a self-hosted OSRM container built from a
 * Ghana/Togo/Benin OSM extract -- one container, no per-request cost, sub-20ms
 * on the order-creation path, which is cheaper than Google Distance Matrix at
 * any volume this platform will reach.
 *
 * Falls back to haversine on any failure, the same way GoogleMapsProvider
 * does. A routing server being down must degrade the *accuracy* of a quote,
 * never block an order from being created.
 */
@Injectable()
export class OsrmProvider implements DistanceProvider {
  readonly name = 'osrm';
  private readonly logger = new Logger(OsrmProvider.name);

  /**
   * Long enough for a cold routing server, short enough that order creation
   * does not visibly hang on a bad connection -- the same 5s the Google
   * provider uses.
   */
  private static readonly TIMEOUT_MS = 5_000;

  constructor(
    private readonly config: AppConfigService,
    private readonly fallback: HaversineProvider,
  ) {}

  async distance(origin: LatLng, destination: LatLng): Promise<DistanceResult> {
    const baseUrl = this.config.get('OSRM_BASE_URL').replace(/\/+$/, '');

    try {
      // OSRM takes lng,lat -- the opposite order from every other coordinate
      // in this codebase. Getting it backwards does not error: it routes
      // between two other places entirely and returns a confident answer.
      const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
      const url = new URL(`${baseUrl}/route/v1/driving/${coordinates}`);
      url.searchParams.set('overview', 'false');

      const res = await fetch(url, {
        signal: AbortSignal.timeout(OsrmProvider.TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const body = (await res.json()) as OsrmRouteResponse;
      const route = body.routes?.[0];
      if (body.code !== 'Ok' || !route || typeof route.distance !== 'number') {
        // "NoRoute" is the interesting case: two points with no road between
        // them (an island, a bad geocode). Falling back gives a straight-line
        // estimate, which is at least a number the caller can price, and the
        // `source` field records that it was not a real route.
        throw new Error(`OSRM code: ${body.code ?? 'malformed response'}`);
      }

      return {
        distanceKm: Math.round((route.distance / 1000) * 100) / 100,
        durationMin: typeof route.duration === 'number' ? Math.round(route.duration / 60) : null,
        source: this.name,
      };
    } catch (err) {
      this.logger.warn(
        `OSRM routing failed (${(err as Error).message}); using haversine fallback.`,
      );
      return this.fallback.distance(origin, destination);
    }
  }
}

interface OsrmRouteResponse {
  code?: string;
  routes?: Array<{
    /** Metres. */
    distance?: number;
    /** Seconds. */
    duration?: number;
  }>;
}

import { Injectable } from '@nestjs/common';
import { CountryCode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NearbyOrderRow {
  id: string;
  client_id: string;
  pickup_address: string;
  pickup_lat: string;
  pickup_lng: string;
  delivery_address: string;
  delivery_lat: string;
  delivery_lng: string;
  description: string | null;
  distance_km: string | null;
  min_price_suggested: string | null;
  status: string;
  scheduled_time: Date | null;
  published_at: Date | null;
  created_at: Date;
  meters: number;
}

/**
 * PostGIS proximity queries. Uses geography(ST_MakePoint(lng, lat)) expressions
 * that match the GiST indexes created in prisma/postgis.sql.
 */
@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Published orders whose pickup point is within `radiusKm` of (lat, lng),
   * nearest first. Optionally excludes a client's own orders.
   */
  async findPublishedOrdersNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    excludeClientId?: string,
  ): Promise<NearbyOrderRow[]> {
    const radiusMeters = radiusKm * 1000;
    return this.prisma.$queryRaw<NearbyOrderRow[]>(Prisma.sql`
      SELECT o.id, o.client_id, o.pickup_address, o.pickup_lat, o.pickup_lng,
             o.delivery_address, o.delivery_lat, o.delivery_lng, o.description,
             o.distance_km, o.min_price_suggested, o.status::text AS status,
             o.scheduled_time, o.published_at, o.created_at,
             ST_Distance(
               geography(ST_MakePoint(o.pickup_lng::float8, o.pickup_lat::float8)),
               geography(ST_MakePoint(${lng}::float8, ${lat}::float8))
             ) AS meters
      FROM orders o
      WHERE o.status::text IN ('published', 'offers_received')
        AND (${excludeClientId ?? null}::uuid IS NULL OR o.client_id <> ${excludeClientId ?? null}::uuid)
        AND ST_DWithin(
              geography(ST_MakePoint(o.pickup_lng::float8, o.pickup_lat::float8)),
              geography(ST_MakePoint(${lng}::float8, ${lat}::float8)),
              ${radiusMeters}::float8
            )
      ORDER BY meters ASC
      LIMIT 100
    `);
  }

  /**
   * IDs of online, active drivers of a given country within `radiusKm` of a
   * point (used to fan out push/socket notifications when an order publishes).
   */
  async findOnlineDriverIdsNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    country: CountryCode,
  ): Promise<string[]> {
    const radiusMeters = radiusKm * 1000;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT u.id
      FROM users u
      WHERE u.role::text IN ('livreur', 'both')
        AND u.is_online = true
        AND u.is_active = true
        AND u.country_code::text = ${country}
        AND u.location_lat IS NOT NULL
        AND u.location_lng IS NOT NULL
        AND ST_DWithin(
              geography(ST_MakePoint(u.location_lng::float8, u.location_lat::float8)),
              geography(ST_MakePoint(${lng}::float8, ${lat}::float8)),
              ${radiusMeters}::float8
            )
      LIMIT 500
    `);
    return rows.map((r) => r.id);
  }

  /**
   * Positions of online, active drivers within `radiusKm` of a point.
   *
   * Positions only -- no id, no name, no vehicle. This feeds the client's map,
   * where the pins say "there is work being done around you" and nothing more;
   * a client has no business knowing *which* driver is parked outside their
   * building, and an id here would let anyone poll the endpoint and follow a
   * named person around the city. The driver's identity becomes visible at
   * exactly one moment: when they win the delivery.
   *
   * `locationUpdatedAt` bounds staleness. `is_online` is a flag a driver can
   * leave set by closing the app on a dying battery, and a pin that has not
   * moved in three hours is a ghost that makes the city look busier than it
   * is -- which is the one lie a marketplace map must not tell.
   */
  async findOnlineDriverPositionsNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    country: CountryCode,
    freshWithinMinutes: number,
  ): Promise<Array<{ lat: number; lng: number }>> {
    const radiusMeters = radiusKm * 1000;
    const rows = await this.prisma.$queryRaw<Array<{ lat: number; lng: number }>>(Prisma.sql`
      SELECT u.location_lat::float8 AS lat, u.location_lng::float8 AS lng
      FROM users u
      WHERE u.role::text IN ('livreur', 'both')
        AND u.is_online = true
        AND u.is_active = true
        AND u.country_code::text = ${country}
        AND u.location_lat IS NOT NULL
        AND u.location_lng IS NOT NULL
        AND u.location_updated_at IS NOT NULL
        AND u.location_updated_at > NOW() - (${freshWithinMinutes}::int * INTERVAL '1 minute')
        AND ST_DWithin(
              geography(ST_MakePoint(u.location_lng::float8, u.location_lat::float8)),
              geography(ST_MakePoint(${lng}::float8, ${lat}::float8)),
              ${radiusMeters}::float8
            )
      LIMIT 100
    `);
    return rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lng) }));
  }
}

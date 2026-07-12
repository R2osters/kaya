-- ===========================================================================
-- Kaya - PostGIS enablement + geography GiST index (Milestone 1).
--
-- Historical reference only: these statements are now versioned as migration
-- `prisma/migrations/20260710000001_postgis_indexes/` and applied automatically
-- by `prisma migrate deploy`. This file is idempotent (IF NOT EXISTS) and kept
-- for manual/ad-hoc use, but is no longer a required separate deploy step.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- Functional GiST index over a geography point built from (lng, lat).
-- NOTE: ST_MakePoint takes (longitude, latitude) in that order.
-- Enables fast ST_DWithin(...) radius queries.
-- Backs "online drivers within radius" (order publish fan-out).
CREATE INDEX IF NOT EXISTS users_location_gist_idx
  ON users
  USING GIST (
    geography(ST_MakePoint(location_lng, location_lat))
  );

-- Backs GET /orders/nearby ("published orders within radius of the driver").
CREATE INDEX IF NOT EXISTS orders_pickup_gist_idx
  ON orders
  USING GIST (
    geography(ST_MakePoint(pickup_lng, pickup_lat))
  );

-- Functional GiST indexes for proximity search (M2: "drivers/orders within radius").
-- NOTE: ST_MakePoint takes (longitude, latitude) in that order.
CREATE INDEX IF NOT EXISTS users_location_gist_idx
  ON users
  USING GIST (
    geography(ST_MakePoint(location_lng, location_lat))
  );

CREATE INDEX IF NOT EXISTS orders_pickup_gist_idx
  ON orders
  USING GIST (
    geography(ST_MakePoint(pickup_lng, pickup_lat))
  );

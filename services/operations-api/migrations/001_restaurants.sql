-- Restaurants, their managers and the audit log.
-- Applied by hand, before deploying the API: psql "$DATABASE_URL" -f migrations/001_restaurants.sql
-- (no migration tool is adopted yet).

CREATE TABLE restaurants (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  -- Set by the operator when adding the restaurant.
  address text NOT NULL,
  -- Whole km, straight-line from the address. NULL means delivery is off.
  delivery_radius_km integer NULL CHECK (delivery_radius_km BETWEEN 1 AND 50)
);

CREATE TABLE restaurant_managers (
  restaurant_id uuid NOT NULL REFERENCES restaurants (id),
  user_id text NOT NULL,
  tenant_id uuid NOT NULL,
  PRIMARY KEY (restaurant_id, user_id)
);

-- Append-only (ADR-0004): the API only ever inserts.
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Down:
-- DROP TABLE audit_log;
-- DROP TABLE restaurant_managers;
-- DROP TABLE restaurants;

CREATE TABLE restaurants (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE restaurant_managers (
  tenant_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants (id),
  user_sub text NOT NULL,
  PRIMARY KEY (restaurant_id, user_sub)
);

CREATE TABLE menu_sections (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants (id),
  name text NOT NULL,
  position int NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants (id),
  section_id uuid NOT NULL REFERENCES menu_sections (id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10, 2) NOT NULL CHECK (price > 0),
  position int NOT NULL DEFAULT 0
);

-- Append-only: the code only ever INSERTs (ADR-0004).
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  actor_sub text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  detail jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX menu_sections_restaurant_idx ON menu_sections (restaurant_id);
CREATE INDEX menu_items_section_idx ON menu_items (section_id);

-- Enforce append-only even for the owner role: reject UPDATE and DELETE on audit_log.
CREATE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_change
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

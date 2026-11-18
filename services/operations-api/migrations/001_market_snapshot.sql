-- Latest market overview, written by the Background Worker and read by the Operations API.
-- Global reference data, not tenant-owned, so no tenant_id. Always the single row id = 1.
CREATE TABLE IF NOT EXISTS market_snapshot (
  id         integer     PRIMARY KEY CHECK (id = 1),
  payload    jsonb       NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Down: DROP TABLE market_snapshot;

-- Latest market overview, written by the Background Worker and read by the Operations API.
-- Market data is shared reference data, so there is no tenant_id.
create table market_snapshot (
  id smallint primary key check (id = 1),
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- down: drop table market_snapshot;

import type { Pool } from "pg";
import { buildOverview } from "./build-overview.js";
import type { MarketDataProvider } from "./provider.js";

const UPSERT = `insert into market_snapshot (id, payload, fetched_at) values (1, $1, now())
  on conflict (id) do update set payload = excluded.payload, fetched_at = excluded.fetched_at`;

/** Fetches, validates and stores the latest overview; any failure leaves the previous snapshot untouched. */
export async function syncMarketOverview(provider: MarketDataProvider, db: Pick<Pool, "query">): Promise<void> {
  const overview = buildOverview(await provider.fetchOverview());
  await db.query(UPSERT, [JSON.stringify(overview)]);
}

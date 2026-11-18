import type { Pool } from "pg";
import { buildOverview } from "./build-overview.js";
import type { MarketDataProvider } from "./types.js";

const UPSERT_SNAPSHOT = `
  INSERT INTO market_snapshot (id, payload, fetched_at)
  VALUES (1, $1::jsonb, now())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`;

/** Fetches the vendor data and replaces the snapshot. On any failure the previous snapshot stays. */
export async function syncMarketOverview(
  provider: MarketDataProvider,
  db: Pick<Pool, "query">,
): Promise<void> {
  try {
    const overview = buildOverview(await provider.fetchOverview());
    await db.query(UPSERT_SNAPSHOT, [JSON.stringify(overview)]);
  } catch (err) {
    console.error("market sync failed; keeping previous snapshot", err);
  }
}

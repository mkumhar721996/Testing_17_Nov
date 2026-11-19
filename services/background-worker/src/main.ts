import pg from "pg";
import { HttpMarketDataProvider } from "./market/provider.js";
import { syncMarketOverview } from "./market/sync.js";
import { createApp } from "./server.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const host = arg("host", process.env.HOST ?? "127.0.0.1");
const port = Number(arg("port", process.env.PORT ?? "3000"));

createApp().listen(port, host, () => {
  console.log(`background-worker listening on ${host}:${port}`);
});

const { MARKET_DATA_API_URL, MARKET_DATA_API_KEY } = process.env;
if (MARKET_DATA_API_URL && MARKET_DATA_API_KEY) {
  const provider = new HttpMarketDataProvider(MARKET_DATA_API_URL, MARKET_DATA_API_KEY);
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const sync = () =>
    syncMarketOverview(provider, db).catch((err: unknown) =>
      console.error("market sync failed; keeping the previous snapshot", err),
    );
  void sync();
  setInterval(sync, Number(process.env.MARKET_SYNC_INTERVAL_MS ?? 300000));
} else {
  console.log("market sync skipped: MARKET_DATA_API_URL and MARKET_DATA_API_KEY are not set");
}

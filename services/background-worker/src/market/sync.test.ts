import { describe, expect, it, vi } from "vitest";
import { syncMarketOverview } from "./sync.js";
import type { RawMarketData } from "./types.js";

const raw: RawMarketData = {
  asOf: "2026-11-17T15:42:00.000Z",
  indices: {
    sp500: { value: 1, changePct: 0.1 },
    nasdaq: { value: 2, changePct: 0.2 },
    dow: { value: 3, changePct: -0.3 },
  },
  volume: 1_000_000,
  movers: [
    { symbol: "A", changePct: 1 },
    { symbol: "B", changePct: 2 },
    { symbol: "C", changePct: -1 },
    { symbol: "D", changePct: -2 },
  ],
  news: [],
};

describe("syncMarketOverview", () => {
  it("upserts the snapshot once on success", async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await syncMarketOverview({ fetchOverview: async () => raw }, db);
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO market_snapshot/i);
    expect(JSON.parse(params[0]).gainers).toHaveLength(2);
  });

  it("keeps the previous snapshot when the vendor fails", async () => {
    const db = { query: vi.fn() };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await syncMarketOverview(
      {
        fetchOverview: async () => {
          throw new Error("vendor down");
        },
      },
      db,
    );
    expect(db.query).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

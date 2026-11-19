import { describe, expect, it, vi } from "vitest";
import { syncMarketOverview } from "./sync.js";
import type { MarketDataProvider } from "./provider.js";
import type { RawMarketData } from "./types.js";

const raw: RawMarketData = {
  indices: [
    { key: "sp500", value: 4512.3, changePct: 0.8 },
    { key: "nasdaq", value: 14870.12, changePct: 1.1 },
    { key: "dow", value: 35210.55, changePct: -0.2 },
  ],
  volume: 2_400_000_000,
  movers: [
    { symbol: "A", changePct: 4 },
    { symbol: "B", changePct: 2 },
    { symbol: "C", changePct: -1 },
    { symbol: "D", changePct: -2 },
  ],
  news: [],
  asOf: "2026-11-19T10:00:00Z",
};

describe("syncMarketOverview", () => {
  it("upserts the single snapshot row", async () => {
    const db = { query: vi.fn().mockResolvedValue({}) };
    await syncMarketOverview({ fetchOverview: async () => raw }, db);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toMatch(/on conflict \(id\)/);
  });

  it("keeps the previous snapshot when the vendor fails", async () => {
    const db = { query: vi.fn() };
    const p: MarketDataProvider = { fetchOverview: () => Promise.reject(new Error("down")) };
    await expect(syncMarketOverview(p, db)).rejects.toThrow("down");
    expect(db.query).not.toHaveBeenCalled();
  });

  it("never writes partial data", async () => {
    const db = { query: vi.fn() };
    const p: MarketDataProvider = { fetchOverview: async () => ({ ...raw, movers: raw.movers.slice(0, 3) }) };
    await expect(syncMarketOverview(p, db)).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
  });
});

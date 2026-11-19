import { describe, expect, it } from "vitest";
import { buildOverview } from "./build-overview.js";
import type { RawMarketData } from "./types.js";

const base: RawMarketData = {
  indices: [
    { key: "dow", value: 35210.55, changePct: -0.2 },
    { key: "sp500", value: 4512.3, changePct: 0.8 },
    { key: "nasdaq", value: 14870.12, changePct: 1.1 },
  ],
  volume: 2_400_000_000,
  movers: [
    { symbol: "A", changePct: 1 },
    { symbol: "B", changePct: 4.1 },
    { symbol: "C", changePct: 2.7 },
    { symbol: "D", changePct: 0.3 },
    { symbol: "E", changePct: 3 },
    { symbol: "F", changePct: -1.9 },
    { symbol: "G", changePct: -2.3 },
    { symbol: "H", changePct: -0.1 },
    { symbol: "I", changePct: -5 },
    { symbol: "J", changePct: -3 },
  ],
  news: [{ id: "n1", headline: "Fed holds rates", publishedAt: "2026-11-19T09:15:00Z" }],
  asOf: "2026-11-19T10:00:00Z",
};

describe("buildOverview", () => {
  it("returns the four stats in order", () => {
    const o = buildOverview(base);
    expect(o.stats.map((s) => s.key)).toEqual(["sp500", "nasdaq", "dow", "volume"]);
    expect(o.stats[0]).toMatchObject({ label: "S&P 500", value: "4,512.30", changePct: 0.8 });
    expect(o.stats[3]).toMatchObject({ label: "Volume", value: "2.4B", changePct: null });
  });

  it("keeps exactly the top two gainers and losers", () => {
    const o = buildOverview(base);
    expect(o.gainers.map((g) => g.symbol)).toEqual(["B", "E"]);
    expect(o.losers.map((l) => l.symbol)).toEqual(["I", "J"]);
    expect(o.gainers.every((g) => g.changePct > 0)).toBe(true);
    expect(o.losers.every((l) => l.changePct < 0)).toBe(true);
  });

  it("throws when there are fewer than two gainers or losers", () => {
    const oneLoser = { ...base, movers: base.movers.filter((m) => m.changePct > 0 || m.symbol === "I") };
    expect(() => buildOverview(oneLoser)).toThrow();
    const oneGainer = { ...base, movers: base.movers.filter((m) => m.changePct < 0 || m.symbol === "B") };
    expect(() => buildOverview(oneGainer)).toThrow();
  });

  it("throws when an index is missing", () => {
    expect(() => buildOverview({ ...base, indices: base.indices.slice(1) })).toThrow();
  });

  it("passes news and asOf through", () => {
    const o = buildOverview(base);
    expect(o.news).toEqual(base.news);
    expect(o.asOf).toBe(base.asOf);
  });
});

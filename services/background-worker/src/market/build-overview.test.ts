import { describe, expect, it } from "vitest";
import { buildOverview } from "./build-overview.js";
import type { RawMarketData } from "./types.js";

const raw: RawMarketData = {
  asOf: "2026-11-17T15:42:00.000Z",
  indices: {
    sp500: { value: 4512.3, changePct: 0.8 },
    nasdaq: { value: 14870.12, changePct: 1.1 },
    dow: { value: 35210.55, changePct: -0.2 },
  },
  volume: 2_400_000_000,
  movers: [
    { symbol: "A", changePct: 1.0 },
    { symbol: "NVDA", changePct: 4.1 },
    { symbol: "B", changePct: 0.5 },
    { symbol: "AMD", changePct: 2.7 },
    { symbol: "C", changePct: 1.5 },
    { symbol: "INTC", changePct: -1.9 },
    { symbol: "TSLA", changePct: -2.3 },
    { symbol: "D", changePct: -0.1 },
    { symbol: "E", changePct: -0.4 },
    { symbol: "F", changePct: -1.0 },
  ],
  news: [{ id: "n1", headline: "Fed holds rates", publishedAt: "2026-11-17T09:15:00.000Z" }],
};

describe("buildOverview", () => {
  it("returns the four stats in order, formatted", () => {
    const o = buildOverview(raw);
    expect(o.stats.map((s) => s.key)).toEqual(["sp500", "nasdaq", "dow", "volume"]);
    expect(o.stats.map((s) => s.label)).toEqual(["S&P 500", "Nasdaq", "Dow", "Volume"]);
    expect(o.stats[0].value).toBe("4,512.30");
    expect(o.stats[3].value).toBe("2.4B");
    expect(o.stats[3].changePct).toBeNull();
  });

  it("keeps exactly the top two gainers and losers by magnitude", () => {
    const o = buildOverview(raw);
    expect(o.gainers).toEqual([
      { symbol: "NVDA", changePct: 4.1 },
      { symbol: "AMD", changePct: 2.7 },
    ]);
    expect(o.losers).toEqual([
      { symbol: "TSLA", changePct: -2.3 },
      { symbol: "INTC", changePct: -1.9 },
    ]);
  });

  it("passes news through", () => {
    expect(buildOverview(raw).news).toEqual(raw.news);
    expect(buildOverview(raw).asOf).toBe(raw.asOf);
  });
});

import type { MarketOverview, RawMarketData } from "./types.js";

const MOVERS_PER_SIDE = 2;

const indexFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatVolume(shares: number): string {
  if (shares >= 1e9) return `${(shares / 1e9).toFixed(1)}B`;
  if (shares >= 1e6) return `${(shares / 1e6).toFixed(1)}M`;
  return new Intl.NumberFormat("en-US").format(shares);
}

export function buildOverview(raw: RawMarketData): MarketOverview {
  const gainers = raw.movers
    .filter((m) => m.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, MOVERS_PER_SIDE);
  const losers = raw.movers
    .filter((m) => m.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, MOVERS_PER_SIDE);

  return {
    stats: [
      { key: "sp500", label: "S&P 500", value: indexFormat.format(raw.indices.sp500.value), changePct: raw.indices.sp500.changePct },
      { key: "nasdaq", label: "Nasdaq", value: indexFormat.format(raw.indices.nasdaq.value), changePct: raw.indices.nasdaq.changePct },
      { key: "dow", label: "Dow", value: indexFormat.format(raw.indices.dow.value), changePct: raw.indices.dow.changePct },
      { key: "volume", label: "Volume", value: formatVolume(raw.volume), changePct: null },
    ],
    gainers: gainers.map(({ symbol, changePct }) => ({ symbol, changePct })),
    losers: losers.map(({ symbol, changePct }) => ({ symbol, changePct })),
    news: raw.news,
    asOf: raw.asOf,
  };
}

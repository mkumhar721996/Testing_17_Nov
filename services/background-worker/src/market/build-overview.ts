import type { MarketOverview, RawMarketData } from "./types.js";

const INDEX_LABELS = { sp500: "S&P 500", nasdaq: "Nasdaq", dow: "Dow" } as const;

const formatIndex = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatVolume(n: number): string {
  for (const [size, suffix] of [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]] as const) {
    if (n >= size) return `${Number((n / size).toFixed(1))}${suffix}`;
  }
  return String(n);
}

/** Shapes the vendor's answer into the stored overview; throws rather than return partial data. */
export function buildOverview(raw: RawMarketData): MarketOverview {
  const stats: MarketOverview["stats"] = (["sp500", "nasdaq", "dow"] as const).map((key) => {
    const index = raw.indices.find((i) => i.key === key);
    if (!index) throw new Error(`Market data is missing the ${INDEX_LABELS[key]} index`);
    return { key, label: INDEX_LABELS[key], value: formatIndex(index.value), changePct: index.changePct };
  });
  stats.push({ key: "volume", label: "Volume", value: formatVolume(raw.volume), changePct: null });

  const gainers = raw.movers
    .filter((m) => m.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 2);
  const losers = raw.movers
    .filter((m) => m.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 2);
  if (gainers.length < 2 || losers.length < 2) {
    throw new Error("Market data needs at least two gainers and two losers");
  }

  return { stats, gainers, losers, news: raw.news, asOf: raw.asOf };
}

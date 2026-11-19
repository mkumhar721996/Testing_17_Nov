export interface MarketOverview {
  stats: { key: "sp500" | "nasdaq" | "dow" | "volume"; label: string; value: string; changePct: number | null }[];
  gainers: { symbol: string; changePct: number }[];
  losers: { symbol: string; changePct: number }[];
  news: { id: string; headline: string; publishedAt: string }[];
  asOf: string;
}

/** What the market data vendor answers, before it is shaped into a MarketOverview. */
export interface RawMarketData {
  indices: { key: "sp500" | "nasdaq" | "dow"; value: number; changePct: number }[];
  volume: number;
  movers: { symbol: string; changePct: number }[];
  news: { id: string; headline: string; publishedAt: string }[];
  asOf: string;
}

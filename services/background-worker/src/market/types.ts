export type StatKey = "sp500" | "nasdaq" | "dow" | "volume";

export interface MarketOverview {
  stats: { key: StatKey; label: string; value: string; changePct: number | null }[];
  gainers: { symbol: string; changePct: number }[];
  losers: { symbol: string; changePct: number }[];
  news: { id: string; headline: string; publishedAt: string }[];
  asOf: string;
}

/** The vendor-neutral shape the provider returns; `buildOverview` maps it to `MarketOverview`. */
export interface RawMarketData {
  indices: Record<"sp500" | "nasdaq" | "dow", { value: number; changePct: number }>;
  /** Shares traded today. */
  volume: number;
  movers: { symbol: string; changePct: number }[];
  news: { id: string; headline: string; publishedAt: string }[];
  asOf: string;
}

export interface MarketDataProvider {
  fetchOverview(): Promise<RawMarketData>;
}

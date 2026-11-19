import type { RawMarketData } from "./types.js";

export interface MarketDataProvider {
  fetchOverview(): Promise<RawMarketData>;
}

/** Calls the configured market data vendor over HTTP; the vendor's JSON is expected as RawMarketData. */
export class HttpMarketDataProvider implements MarketDataProvider {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async fetchOverview(): Promise<RawMarketData> {
    const res = await fetch(this.url, { headers: { authorization: `Bearer ${this.apiKey}` } });
    if (!res.ok) throw new Error(`Market data vendor answered ${res.status}`);
    return (await res.json()) as RawMarketData;
  }
}

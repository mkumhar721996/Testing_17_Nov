import type { MarketDataProvider, RawMarketData } from "./types.js";

/**
 * Calls the third-party market data vendor over HTTP. The vendor is not chosen yet, so this
 * expects the vendor-neutral `RawMarketData` JSON; map the real vendor's response here.
 */
export class HttpMarketDataProvider implements MarketDataProvider {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async fetchOverview(): Promise<RawMarketData> {
    const res = await fetch(this.url, {
      headers: { authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`market data vendor responded ${res.status}`);
    return (await res.json()) as RawMarketData;
  }
}

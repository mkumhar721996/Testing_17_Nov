import { describe, expect, it, vi } from 'vitest';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import type { MarketOverview } from './market.types';

const stored: MarketOverview = {
  stats: [{ key: 'sp500', label: 'S&P 500', value: '4,512.30', changePct: 0.8 }],
  gainers: [
    { symbol: 'NVDA', changePct: 4.1 },
    { symbol: 'AMD', changePct: 2.7 },
  ],
  losers: [
    { symbol: 'INTC', changePct: -1.9 },
    { symbol: 'TSLA', changePct: -2.3 },
  ],
  news: [{ id: 'n1', headline: 'Fed holds rates steady', publishedAt: '2026-11-19T09:15:00Z' }],
  asOf: '2026-11-19T10:00:00Z',
};

const controllerWith = (rows: { payload: MarketOverview }[]) => {
  const pool = { query: vi.fn().mockResolvedValue({ rows }) };
  return new MarketController(new MarketService(pool as never));
};

describe('MarketController', () => {
  it('returns the stored overview, news included', async () => {
    const overview = await controllerWith([{ payload: stored }]).overview();
    expect(overview).toEqual(stored);
    expect(overview.news).toEqual(stored.news);
  });

  it('answers 503 until the first sync has stored a snapshot', async () => {
    await expect(controllerWith([]).overview()).rejects.toMatchObject({ status: 503 });
  });
});

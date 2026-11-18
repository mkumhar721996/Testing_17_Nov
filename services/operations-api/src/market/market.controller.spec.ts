import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { PG_POOL } from '../database/database.module';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import type { MarketOverview } from './market.types';

const snapshot: MarketOverview = {
  stats: [
    { key: 'sp500', label: 'S&P 500', value: '4,512.30', changePct: 0.8 },
    { key: 'volume', label: 'Volume', value: '2.4B', changePct: null },
  ],
  gainers: [
    { symbol: 'NVDA', changePct: 4.1 },
    { symbol: 'AMD', changePct: 2.7 },
  ],
  losers: [
    { symbol: 'TSLA', changePct: -2.3 },
    { symbol: 'INTC', changePct: -1.9 },
  ],
  news: [{ id: 'n1', headline: 'Fed holds rates', publishedAt: '2026-11-17T09:15:00.000Z' }],
  asOf: '2026-11-17T15:42:00.000Z',
};

async function controllerWith(rows: { payload: MarketOverview }[]) {
  const pool = { query: vi.fn().mockResolvedValue({ rows }) };
  const mod = await Test.createTestingModule({
    controllers: [MarketController],
    providers: [MarketService, { provide: PG_POOL, useValue: pool }],
  }).compile();
  return { controller: mod.get(MarketController), pool };
}

describe('MarketController', () => {
  it('returns the stored snapshot unchanged, news included', async () => {
    const { controller, pool } = await controllerWith([{ payload: snapshot }]);
    const overview = await controller.overview();
    expect(overview).toEqual(snapshot);
    expect(overview.news).toBe(snapshot.news);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('answers 503 when no snapshot exists yet', async () => {
    const { controller } = await controllerWith([]);
    const err = await controller.overview().catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()).toEqual({ error: 'market data unavailable' });
  });
});

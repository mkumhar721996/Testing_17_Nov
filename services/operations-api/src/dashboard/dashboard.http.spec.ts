import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TOKEN_VERIFIER } from '../auth/token-verifier';
import { AuthModule } from '../auth/auth.module';
import { HealthModule } from '../health/health.module';
import { DashboardModule } from './dashboard.module';

let app: INestApplication;
let base: string;

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    imports: [AuthModule, DashboardModule, HealthModule],
  })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({
      verify: async (t: string) => {
        if (!t.startsWith('user-')) throw new Error('invalid');
        return { sub: t };
      },
    })
    .compile();
  app = mod.createNestApplication();
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
afterAll(() => app.close());

const rawGet = (p: string, token = 'user-a') =>
  fetch(base + p, { headers: { authorization: `Bearer ${token}` } });
const get = async (p: string, token = 'user-a') => (await rawGet(p, token)).json() as Promise<any>;

const today = new Date().toISOString().slice(0, 10);
const ranges = ['1M', '1Y', 'All'];

describe('auth', () => {
  it('returns 401 without a valid sign-in, but /health stays open', async () => {
    const paths = [
      '/dashboard/portfolio',
      '/dashboard/charts/growth?range=1M',
      '/dashboard/charts/returns?range=1M',
      '/dashboard/charts/allocation',
      '/dashboard/sips',
      '/dashboard/market-movers',
      '/dashboard/ipos',
      '/dashboard/ipos/skyline',
    ];
    for (const p of paths) {
      expect((await fetch(base + p)).status).toBe(401);
      expect((await rawGet(p, 'bogus')).status).toBe(401);
    }
    expect((await fetch(base + '/health')).status).toBe(200);
  });
});

describe('dashboard data', () => {
  it('AC1 portfolio summary', async () => {
    const body = await get('/dashboard/portfolio');
    expect(body.summary).toEqual(
      expect.objectContaining({
        portfolioValue: 482310,
        investedAmount: 420000,
        returns: 62310,
        nextSip: expect.objectContaining({ date: expect.any(String), amount: 5000 }),
      }),
    );
  });
  it.each(['growth', 'returns'])('AC2/3 %s for each range', async (kind) => {
    for (const r of ranges) {
      const b = await get(`/dashboard/charts/${kind}?range=${r}`);
      expect(b.range).toBe(r);
      expect(b.series.length).toBeGreaterThan(0);
      expect(b.series[0]).toEqual({ date: expect.any(String), value: expect.any(Number) });
    }
    expect((await rawGet(`/dashboard/charts/${kind}?range=5Y`)).status).toBe(400);
    expect((await rawGet(`/dashboard/charts/${kind}`)).status).toBe(400);
  });
  it('AC2/3 series end at the current portfolio figures', async () => {
    for (const r of ranges) {
      const g = await get(`/dashboard/charts/growth?range=${r}`);
      const ret = await get(`/dashboard/charts/returns?range=${r}`);
      expect(g.series.at(-1).value).toBe(482310);
      expect(ret.series.at(-1).value).toBe(62310);
    }
  });
  it('AC4 allocation is one snapshot for today', async () => {
    const b = await get('/dashboard/charts/allocation');
    expect(b.asOf).toBe(today);
    expect(b.slices.map((s: any) => [s.assetClass, s.percent])).toEqual([
      ['Equity', 55],
      ['Debt', 25],
      ['Gold', 12],
      ['Cash', 8],
    ]);
    expect(b).not.toHaveProperty('range');
  });
  it('AC5 SIP list', async () => {
    const b = await get('/dashboard/sips');
    expect(b.sips).toHaveLength(4);
    for (const s of b.sips) {
      expect(s).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          fundName: expect.any(String),
          amount: expect.any(Number),
          nextDate: expect.any(String),
          status: expect.stringMatching(/^(Active|Paused)$/),
        }),
      );
    }
  });
  it('AC6 market movers', async () => {
    const b = await get('/dashboard/market-movers');
    expect(b.asOf).toBe(today);
    expect(b.gainers).toHaveLength(3);
    expect(b.losers).toHaveLength(3);
    expect(b.gainers.every((g: any) => g.changePercent > 0)).toBe(true);
    expect(b.losers.every((g: any) => g.changePercent < 0)).toBe(true);
  });
  it('AC7/8 open IPOs only, each with detail', async () => {
    const b = await get('/dashboard/ipos');
    expect(b.ipos.map((i: any) => i.id).sort()).toEqual(['greenleaf', 'skyline']);
    expect(b.ipos.every((i: any) => i.status === 'open')).toBe(true);
    for (const i of b.ipos) {
      const d = await get(`/dashboard/ipos/${i.id}`);
      expect(d).toEqual(
        expect.objectContaining({
          id: i.id,
          sector: expect.any(String),
          priceBandLow: expect.any(Number),
          priceBandHigh: expect.any(Number),
          lotSize: expect.any(Number),
          minInvestment: expect.any(Number),
        }),
      );
    }
    expect((await rawGet('/dashboard/ipos/unknown')).status).toBe(404);
  });
  it('AC9 single investor', async () => {
    const p = await get('/dashboard/portfolio');
    const s = await get('/dashboard/sips');
    expect(
      new Set([p.investorId, s.investorId, ...s.sips.map((x: any) => x.investorId)]).size,
    ).toBe(1);
  });
  it('AC10 same data for every user', async () => {
    for (const p of [
      '/dashboard/portfolio',
      '/dashboard/sips',
      '/dashboard/market-movers',
      '/dashboard/ipos',
    ]) {
      expect(await get(p, 'user-a')).toEqual(await get(p, 'user-b'));
    }
  });
});

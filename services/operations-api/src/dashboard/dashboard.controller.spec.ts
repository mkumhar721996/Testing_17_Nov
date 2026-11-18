import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TOKEN_VERIFIER } from '../auth/auth.guard';
import { DashboardModule } from './dashboard.module';

const fakeVerifier = {
  verify: async (token: string) => {
    if (token === 'a' || token === 'b') return { sub: `user-${token}` };
    throw new Error('rejected');
  },
};

describe('DashboardController', () => {
  let app: INestApplication;
  let base: string;
  const get = (path: string, token?: string) =>
    fetch(base + path, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [DashboardModule] })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .compile();
    app = mod.createNestApplication();
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(() => app.close());

  it('returns the same data to every signed-in user (AC10)', async () => {
    for (const path of ['/dashboard/portfolio', '/dashboard/sips', '/dashboard/market-movers', '/dashboard/ipos']) {
      const ra = await (await get(path, 'a')).json();
      const rb = await (await get(path, 'b')).json();
      expect(rb).toEqual(ra);
    }
  });

  it('returns 401 without a valid sign-in on every route (AC11)', async () => {
    const paths = [
      '/dashboard/portfolio',
      '/dashboard/sips',
      '/dashboard/market-movers',
      '/dashboard/ipos',
      '/dashboard/ipos/skyline',
      '/dashboard/charts/growth?range=1m',
      '/dashboard/charts/returns?range=1m',
      '/dashboard/charts/allocation',
    ];
    for (const path of paths) {
      expect((await get(path)).status).toBe(401);
      expect((await get(path, 'bad')).status).toBe(401);
    }
    expect((await get('/dashboard/portfolio', 'a')).status).toBe(200);
  });

  it('serves growth and returns series per range, 400 otherwise (AC2, AC3)', async () => {
    for (const kind of ['growth', 'returns']) {
      for (const range of ['1m', '1y', 'all']) {
        const body = await (await get(`/dashboard/charts/${kind}?range=${range}`, 'a')).json();
        expect(body.range).toBe(range);
        expect(body.points.length).toBeGreaterThan(1);
      }
      expect((await get(`/dashboard/charts/${kind}?range=5y`, 'a')).status).toBe(400);
      expect((await get(`/dashboard/charts/${kind}`, 'a')).status).toBe(400);
    }
  });

  it('allocation ignores range (AC4)', async () => {
    const plain = await (await get('/dashboard/charts/allocation', 'a')).json();
    const ranged = await (await get('/dashboard/charts/allocation?range=1y', 'a')).json();
    expect(ranged).toEqual(plain);
    expect(plain.asOf).toBe('2026-11-17');
  });

  it('serves IPO detail, 404 when not open (AC7, AC8)', async () => {
    const list = await (await get('/dashboard/ipos', 'a')).json();
    expect(list.map((i: { id: string }) => i.id).sort()).toEqual(['greenleaf', 'skyline']);
    expect((await get('/dashboard/ipos/skyline', 'a')).status).toBe(200);
    expect((await get('/dashboard/ipos/harbor-closed', 'a')).status).toBe(404);
  });
});

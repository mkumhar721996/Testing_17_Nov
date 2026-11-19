import { expect, test } from '@playwright/test';

test.skip(!process.env.DATABASE_URL, 'needs a migrated PostgreSQL (DATABASE_URL)');

const signedIn = { 'x-user-id': 'emp-1', 'x-tenant-id': 'tenant-1', 'x-roles': 'employee' };

test('a signed-in user reads the market overview or gets 503 before the first sync', async ({ request }) => {
  const res = await request.get('/market/overview', { headers: signedIn });
  expect([200, 503]).toContain(res.status());
  if (res.status() === 503) expect(await res.json()).toMatchObject({ code: 'MARKET_DATA_UNAVAILABLE' });
});

test('an anonymous caller is refused', async ({ request }) => {
  expect((await request.get('/market/overview')).status()).toBe(401);
});

test('the overview offers no way to change it', async ({ request }) => {
  for (const m of ['post', 'put', 'patch', 'delete'] as const) {
    expect((await request[m]('/market/overview', { headers: signedIn })).status()).toBe(404);
  }
});

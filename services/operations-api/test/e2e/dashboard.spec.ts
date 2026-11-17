import { expect, test } from '@playwright/test';

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
  test(`GET ${p} without sign-in returns 401`, async ({ request }) => {
    expect((await request.get(p)).status()).toBe(401);
  });
}

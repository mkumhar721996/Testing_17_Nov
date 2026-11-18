import { expect, test } from '@playwright/test';

test('GET /dashboard/portfolio without a token is 401', async ({ request }) => {
  expect((await request.get('/dashboard/portfolio')).status()).toBe(401);
});

import { expect, test } from '@playwright/test';

test('the market overview is read-only', async ({ request }) => {
  for (const method of ['post', 'put', 'patch', 'delete'] as const) {
    const res = await request[method]('/market/overview');
    expect(res.status(), method).toBe(404);
  }
});

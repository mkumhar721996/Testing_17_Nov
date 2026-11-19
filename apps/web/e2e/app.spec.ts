import { test, expect } from '@playwright/test'

test('home page shows the stock dashboard', async ({ page }) => {
  await page.route('**/api/market/overview', (route) => route.fulfill({ status: 503, json: {} }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Stock dashboard' })).toBeVisible()
})

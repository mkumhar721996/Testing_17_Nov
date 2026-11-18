import { test, expect } from '@playwright/test'

test('home page shows the dashboard heading', async ({ page }) => {
  await page.route('**/market/overview', (route) =>
    route.fulfill({ status: 503, json: { error: 'market data unavailable' } }),
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Stock dashboard' })).toBeVisible()
})

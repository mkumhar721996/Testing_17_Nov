import { test, expect } from '@playwright/test'

test('home page shows the Menu page in the console shell', async ({ page }) => {
  await page.route('**/restaurants/**', (route) =>
    route.fulfill({
      json: { restaurant: { id: 'r1', name: 'Bistro', currency: 'USD' }, sections: [] },
    }),
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Operations' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

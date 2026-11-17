import { test, expect } from '@playwright/test'

test('a manager adds a section and an item with a price', async ({ page }) => {
  const menu = {
    restaurant: { id: 'r1', name: 'Bistro', currency: 'USD' },
    sections: [] as { id: string; name: string; items: unknown[] }[],
  }
  await page.route('**/restaurants/**', async (route) => {
    const request = route.request()
    const url = request.url()
    if (request.method() === 'POST' && url.endsWith('/sections')) {
      menu.sections.push({ id: 's1', name: request.postDataJSON().name, items: [] })
      return route.fulfill({ status: 201, json: menu.sections[0] })
    }
    if (request.method() === 'POST' && url.endsWith('/items')) {
      menu.sections[0].items.push({ id: 'i1', ...request.postDataJSON() })
      return route.fulfill({ status: 201, json: menu.sections[0].items[0] })
    }
    return route.fulfill({ json: menu })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Add menu section' }).click()
  await page.getByLabel('Section name').fill('Starters')
  await page.getByRole('button', { name: 'Save section' }).click()
  await expect(page.getByRole('heading', { name: 'Starters' })).toBeVisible()

  await page.getByRole('button', { name: /Add item/ }).click()
  await page.getByLabel('Name', { exact: true }).fill('Tomato soup')
  await page.getByLabel(/Price in USD/).fill('7.50')
  await page.getByRole('button', { name: 'Save item' }).click()
  await expect(page.getByText('Tomato soup')).toBeVisible()
  await expect(page.getByText('$7.50')).toBeVisible()
})

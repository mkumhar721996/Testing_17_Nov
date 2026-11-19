import { test, expect } from '@playwright/test'

const overview = {
  stats: [
    { key: 'sp500', label: 'S&P 500', value: '4,512.30', changePct: 0.8 },
    { key: 'nasdaq', label: 'Nasdaq', value: '14,870.12', changePct: 1.1 },
    { key: 'dow', label: 'Dow', value: '35,210.55', changePct: -0.2 },
    { key: 'volume', label: 'Volume', value: '2.4B', changePct: null },
  ],
  gainers: [
    { symbol: 'NVDA', changePct: 4.1 },
    { symbol: 'AMD', changePct: 2.7 },
  ],
  losers: [
    { symbol: 'INTC', changePct: -1.9 },
    { symbol: 'TSLA', changePct: -2.3 },
  ],
  news: [{ id: 'n1', headline: 'Fed holds rates steady; stocks edge higher', publishedAt: '2026-11-19T09:15:00' }],
  asOf: '2026-11-19T10:00:00',
}

test('the market overview is shown on open, read-only and without a refresh control', async ({ page }) => {
  await page.route('**/api/market/overview', (route) => route.fulfill({ json: overview }))
  await page.goto('/')

  const stats = page.getByLabel('Market stats')
  for (const label of ['S&P 500', 'Nasdaq', 'Dow', 'Volume']) {
    await expect(stats.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('list', { name: 'Top gainers' }).getByRole('listitem')).toHaveCount(2)
  await expect(page.getByRole('list', { name: 'Top losers' }).getByRole('listitem')).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Market news' }).getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /refresh/i })).toHaveCount(0)
})

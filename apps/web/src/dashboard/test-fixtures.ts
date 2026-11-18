import { vi } from 'vitest'
import type { MarketOverview } from './types'

export const overview: MarketOverview = {
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
    { symbol: 'TSLA', changePct: -2.3 },
    { symbol: 'INTC', changePct: -1.9 },
  ],
  news: [
    { id: 'n1', headline: 'Fed holds rates steady', publishedAt: '2026-11-17T09:15:00.000Z' },
    { id: 'n2', headline: 'Chipmakers lead the Nasdaq', publishedAt: '2026-11-17T08:05:00.000Z' },
  ],
  asOf: '2026-11-17T15:42:00.000Z',
}

export function mockFetchOk(data: MarketOverview = overview) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

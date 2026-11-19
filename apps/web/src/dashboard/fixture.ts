import type { MarketOverview } from './types'

export const overviewFixture: MarketOverview = {
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
  news: [
    { id: 'n1', headline: 'Fed holds rates steady; stocks edge higher', publishedAt: '2026-11-19T09:15:00' },
    { id: 'n2', headline: 'Apple unveils quarterly earnings date', publishedAt: '2026-11-19T08:30:00' },
  ],
  asOf: '2026-11-19T10:00:00',
}

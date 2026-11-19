export interface MarketOverview {
  stats: { key: 'sp500' | 'nasdaq' | 'dow' | 'volume'; label: string; value: string; changePct: number | null }[]
  gainers: { symbol: string; changePct: number }[]
  losers: { symbol: string; changePct: number }[]
  news: { id: string; headline: string; publishedAt: string }[]
  asOf: string
}

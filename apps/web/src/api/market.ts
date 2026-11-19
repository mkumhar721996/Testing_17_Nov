import { apiFetch } from './client'
import type { MarketOverview } from '../dashboard/types'

export const getMarketOverview = (signal?: AbortSignal) => apiFetch<MarketOverview>('/market/overview', { signal })

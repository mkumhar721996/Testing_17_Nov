import { useEffect, useState } from 'react'
import { getMarketOverview } from '../api/market'
import type { MarketOverview } from './types'

export const MARKET_LOAD_TIMEOUT_MS = 10000

type Status = 'loading' | 'ready' | 'error'

/** Loads the market overview once when the page opens; it never polls or refetches while shown. */
export function useMarketOverview(): { status: Status; data: MarketOverview | null; retry: () => void } {
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<MarketOverview | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, MARKET_LOAD_TIMEOUT_MS)
    getMarketOverview(controller.signal).then(
      (overview) => {
        clearTimeout(timer)
        setData(overview)
        setStatus('ready')
      },
      () => {
        clearTimeout(timer)
        // An abort from unmounting or a re-run is not a failure to show; only a real error or the timeout is.
        if (timedOut || !controller.signal.aborted) setStatus('error')
      },
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [attempt])

  // Only the error state offers a retry; a loaded overview is never reloaded.
  const retry = () => {
    if (status !== 'error') return
    setStatus('loading')
    setAttempt((n) => n + 1)
  }

  return { status, data, retry }
}

import { useEffect, useState } from 'react'
import type { MarketOverview } from './types'

export const MARKET_LOAD_TIMEOUT_MS = 10_000

type State =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: MarketOverview }
  | { status: 'error'; data: null }

/**
 * Loads the market overview once when the component mounts. There is no polling and no refetch
 * while ready; `retry` is offered only after a failed load.
 */
export function useMarketOverview(): State & { retry: (() => void) | undefined } {
  const [state, setState] = useState<State>({ status: 'loading', data: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let unmounted = false
    const timeout = setTimeout(() => controller.abort(), MARKET_LOAD_TIMEOUT_MS)
    setState({ status: 'loading', data: null })
    fetch('/market/overview', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`market overview responded ${res.status}`)
        return res.json() as Promise<MarketOverview>
      })
      .then((data) => setState({ status: 'ready', data }))
      .catch(() => {
        if (!unmounted) setState({ status: 'error', data: null })
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      unmounted = true
      clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])

  return {
    ...state,
    retry: state.status === 'error' ? () => setAttempt((n) => n + 1) : undefined,
  }
}

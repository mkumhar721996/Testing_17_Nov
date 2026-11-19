import { act, render, screen } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import { overviewFixture } from './fixture'
import { MARKET_LOAD_TIMEOUT_MS } from './useMarketOverview'
import { getMarketOverview } from '../api/market'

vi.mock('../api/market', () => ({ getMarketOverview: vi.fn() }))

afterEach(() => {
  vi.useRealTimers()
})

describe('useMarketOverview', () => {
  it('keeps the values and does not refetch as time passes', async () => {
    vi.mocked(getMarketOverview).mockReset().mockResolvedValue(overviewFixture)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Dashboard />)
    await screen.findByText('4,512.30')
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(screen.getByText('4,512.30')).toBeInTheDocument()
    expect(getMarketOverview).toHaveBeenCalledTimes(1)
  })

  it('shows the error state when the load takes longer than the timeout', async () => {
    vi.mocked(getMarketOverview).mockReset().mockImplementation(
      (signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    )
    vi.useFakeTimers()
    render(<Dashboard />)
    await act(() => vi.advanceTimersByTimeAsync(MARKET_LOAD_TIMEOUT_MS))
    expect(screen.getByRole('alert')).toHaveTextContent('Market data could not be loaded.')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { Dashboard } from './Dashboard'
import { mockFetchOk, overview } from './test-fixtures'

describe('useMarketOverview', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('loads on mount without user action, calling fetch once (AC6)', async () => {
    const fetchMock = mockFetchOk()
    render(<Dashboard />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading market data')
    await screen.findByText('Top movers')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/market/overview', expect.anything())
  })

  it('shows an error with Try again when the load fails, and retries on click', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
    fetchMock.mockResolvedValue({ ok: true, json: async () => overview })
    vi.stubGlobal('fetch', fetchMock)
    render(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Market data could not be loaded.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Top movers')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows the error state on a non-OK response (503 before first sync)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    render(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Market data could not be loaded.')
  })

  it('keeps values and does not refetch as time passes (AC8)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = mockFetchOk()
    render(<Dashboard />)
    await screen.findByText('4,512.30')
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(screen.getByText('4,512.30')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

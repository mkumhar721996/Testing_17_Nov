import { fireEvent, render, screen, within } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import { overviewFixture } from './fixture'
import { getMarketOverview } from '../api/market'

vi.mock('../api/market', () => ({ getMarketOverview: vi.fn() }))

beforeEach(() => {
  vi.mocked(getMarketOverview).mockReset().mockResolvedValue(overviewFixture)
})

describe('Dashboard', () => {
  it('shows a stat for each of S&P 500, Nasdaq, Dow and Volume', async () => {
    render(<Dashboard />)
    for (const label of ['S&P 500', 'Nasdaq', 'Dow', 'Volume']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    const stats = screen.getByLabelText('Market stats')
    expect(stats.querySelectorAll('.stat-label')).toHaveLength(4)
    expect(within(stats).getByText('▲ +0.8%')).toHaveClass('badge-success')
    expect(within(stats).getByText('▼ −0.2%')).toHaveClass('badge-danger')
    expect(within(stats).getByText('Shares traded today')).toHaveClass('badge-neutral')
  })

  it('lists exactly two gainers and two losers', async () => {
    render(<Dashboard />)
    const gainers = within(await screen.findByRole('list', { name: 'Top gainers' }))
    expect(gainers.getAllByRole('listitem')).toHaveLength(2)
    expect(gainers.getByText('NVDA')).toBeInTheDocument()
    const losers = within(screen.getByRole('list', { name: 'Top losers' }))
    expect(losers.getAllByRole('listitem')).toHaveLength(2)
    expect(losers.getByText('▼ −2.3%')).toBeInTheDocument()
  })

  it('shows the news list with times', async () => {
    render(<Dashboard />)
    const news = within(await screen.findByRole('region', { name: 'Market news' }))
    expect(news.getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(news.getByText('Fed holds rates steady; stocks edge higher')).toBeInTheDocument()
    expect(news.getByText('9:15 AM')).toBeInTheDocument()
  })

  it('offers nothing to edit or refresh once loaded', async () => {
    render(<Dashboard />)
    await screen.findByText('Market news')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /refresh|reload|update/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('loads on open without any action and shows a loading state first', async () => {
    render(<Dashboard />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading market data')
    await screen.findByText('Top movers')
    expect(getMarketOverview).toHaveBeenCalledTimes(1)
  })

  it('shows an error with Try again, which loads again', async () => {
    vi.mocked(getMarketOverview).mockRejectedValueOnce(new Error('down'))
    render(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Market data could not be loaded.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Top movers')
    expect(getMarketOverview).toHaveBeenCalledTimes(2)
  })
})

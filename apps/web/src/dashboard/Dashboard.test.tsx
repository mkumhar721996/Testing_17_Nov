import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { Dashboard } from './Dashboard'
import { mockFetchOk } from './test-fixtures'

describe('Dashboard market overview', () => {
  beforeEach(() => {
    mockFetchOk()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a stat for each of S&P 500, Nasdaq, Dow and Volume (AC1)', async () => {
    render(<Dashboard />)
    for (const label of ['S&P 500', 'Nasdaq', 'Dow', 'Volume']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    expect(within(screen.getByLabelText('Market stats')).getAllByRole('group')).toHaveLength(4)
    expect(screen.getByText('▲ +0.8%')).toBeInTheDocument()
    expect(screen.getByText('▼ −0.2%')).toBeInTheDocument()
    expect(screen.getByText('Shares traded today')).toBeInTheDocument()
  })

  it('shows exactly two gainers (AC2) and two losers (AC3)', async () => {
    render(<Dashboard />)
    const gainers = await screen.findByRole('list', { name: 'Top gainers' })
    expect(within(gainers).getAllByRole('listitem')).toHaveLength(2)
    const losers = screen.getByRole('list', { name: 'Top losers' })
    expect(within(losers).getAllByRole('listitem')).toHaveLength(2)
    expect(within(losers).getByText('▼ −2.3%')).toBeInTheDocument()
  })

  it('shows a news list (AC4)', async () => {
    render(<Dashboard />)
    const news = await screen.findByRole('region', { name: 'Market news' })
    expect(within(news).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(within(news).getByText('Fed holds rates steady')).toBeInTheDocument()
  })

  it('offers nothing to edit or refresh once loaded (AC5, AC7)', async () => {
    render(<Dashboard />)
    await screen.findByText('Market news')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /refresh|reload|update/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})

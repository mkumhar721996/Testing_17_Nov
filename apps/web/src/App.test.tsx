import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from './App'
import { mockFetchOk } from './dashboard/test-fixtures'

describe('App', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the shell with the dashboard heading and Overview as current page', async () => {
    mockFetchOk()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Stock dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Account/ })).toBeInTheDocument()
    await screen.findByText('Market news')
  })
})

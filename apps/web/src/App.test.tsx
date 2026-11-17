import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the shell with Operations as the current page and the menu loading', () => {
    vi.stubGlobal('fetch', () => new Promise(() => {}))
    render(<App />)
    expect(screen.getByRole('link', { name: 'Operations' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('Ops Console', { selector: 'a' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading your menu.')
  })
})

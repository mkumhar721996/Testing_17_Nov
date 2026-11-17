import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('marks Operations as the current page and has no Account link or menu button', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'Operations' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('link', { name: /account/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
    expect(screen.getByText('Ops Console')).toBeInTheDocument()
  })
})

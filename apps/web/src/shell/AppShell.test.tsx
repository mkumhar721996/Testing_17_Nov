import { fireEvent, render, screen, within } from '@testing-library/react'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders the top bar, the four sections and the footer, marking Settings as current', () => {
    render(
      <AppShell current="settings">
        <p>content</p>
      </AppShell>,
    )
    expect(screen.getByText('Ops Console', { selector: 'a' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Account/ })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Overview', 'Operations', 'Jobs', 'Settings'])
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Jobs' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('reports the section picked in the navigation', () => {
    const onNavigate = vi.fn()
    render(
      <AppShell current="overview" onNavigate={onNavigate}>
        x
      </AppShell>,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })

  it('opens and closes the navigation from the menu button', () => {
    render(<AppShell current="settings">x</AppShell>)
    const button = screen.getByRole('button', { name: 'Menu' })
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(nav).toHaveClass('is-open')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})

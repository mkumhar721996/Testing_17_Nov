import { fireEvent, render, screen, within } from '@testing-library/react'
import { DashboardPage } from './DashboardPage'

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const search = () => fireEvent.click(screen.getByRole('button', { name: 'Search' }))
const fill = () => {
  type('Destination', 'Lisbon')
  type('Start date', '2026-12-14')
  type('End date', '2026-12-18')
}
const rulesHtml = () => screen.getByRole('heading', { name: 'Baggage and travel rules' }).closest('section')!.innerHTML

afterEach(() => vi.unstubAllGlobals())

describe('DashboardPage', () => {
  it('shows the title, New booking, header, greeting and no footer', () => {
    const onNewBooking = vi.fn()
    render(<DashboardPage onNewBooking={onNewBooking} traveller={{ name: 'Maya Okafor' }} today="2026-11-19" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Your travel dashboard' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New booking' }))
    expect(onNewBooking).toHaveBeenCalledTimes(1)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Overview',
      'Account',
      'Operations',
      'Jobs',
      'Settings',
    ])
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Travellie')).toBeInTheDocument()
    expect(screen.getByText('Welcome back, Maya Okafor. Upcoming trips, bookings and quick search.')).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('Maya Okafor')).toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).toBeNull()
  })

  it('navigates from Overview and Settings only', () => {
    const onNavigate = vi.fn()
    render(<DashboardPage onNewBooking={vi.fn()} onNavigate={onNavigate} today="2026-11-19" />)
    fireEvent.click(screen.getByRole('link', { name: 'Jobs' }))
    expect(onNavigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })

  it('leaves the baggage rules unchanged when search fields change', () => {
    render(<DashboardPage onNewBooking={vi.fn()} today="2026-11-19" />)
    const before = rulesHtml()
    type('Destination', 'Porto')
    type('Adults', '4')
    type('Start date', '2026-12-01')
    expect(rulesHtml()).toBe(before)
  })

  it.each([
    ['rejects', () => vi.fn().mockRejectedValue(new Error('network'))],
    ['hangs', () => vi.fn().mockReturnValue(new Promise(() => {}))],
  ])('keeps both panels usable when the trips request %s', (_n, make) => {
    vi.stubGlobal('fetch', make())
    render(<DashboardPage onNewBooking={vi.fn()} today="2026-11-19" />)
    expect(screen.getByRole('heading', { name: 'Find a trip' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Baggage and travel rules' })).toBeInTheDocument()
    type('Destination', 'Lisbon')
    expect(screen.getByLabelText('Destination')).toHaveValue('Lisbon')
  })

  it('opens the results list on a valid search, not on invalid input', async () => {
    render(<DashboardPage onNewBooking={vi.fn()} today="2026-11-19" />)
    fill()
    type('Start date', '2026-11-18')
    search()
    expect(screen.queryByRole('dialog', { name: 'Search results' })).not.toBeInTheDocument()
    type('Start date', '2026-12-14')
    search()
    const drawer = await screen.findByRole('dialog', { name: 'Search results' })
    expect(within(drawer).getByText(/Lisbon, 2026-12-14 to 2026-12-18, 1 traveller$/)).toBeInTheDocument()
  })

  it('opens with 9 travellers and refuses 10', async () => {
    render(<DashboardPage onNewBooking={vi.fn()} today="2026-11-19" />)
    fill()
    type('Adults', '5')
    type('Children', '5')
    search()
    expect(screen.queryByRole('dialog', { name: 'Search results' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Too many travellers')
    type('Children', '4')
    search()
    expect(await screen.findByRole('dialog', { name: 'Search results' })).toBeInTheDocument()
  })
})

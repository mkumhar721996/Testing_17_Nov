import { fireEvent, render, screen, within } from '@testing-library/react'
import { SearchPanel } from './SearchPanel'

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const search = () => fireEvent.click(screen.getByRole('button', { name: 'Search' }))

function setup(dest = 'Lisbon', start = '2026-12-14', end = '2026-12-18') {
  const onSearch = vi.fn()
  render(<SearchPanel today="2026-11-19" onSearch={onSearch} />)
  type('Destination', dest)
  type('Start date', start)
  type('End date', end)
  return onSearch
}

describe('SearchPanel', () => {
  it('shows all fields and defaults of 1 adult and 0 children', () => {
    render(<SearchPanel today="2026-11-19" onSearch={vi.fn()} />)
    for (const l of ['Destination', 'Start date', 'End date', 'Adults', 'Children']) {
      expect(screen.getByLabelText(l)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Adults')).toHaveValue(1)
    expect(screen.getByLabelText('Children')).toHaveValue(0)
  })

  it('enables Search only when destination and both dates are filled', () => {
    render(<SearchPanel today="2026-11-19" onSearch={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    type('Destination', 'Lisbon')
    type('Start date', '2026-12-14')
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    type('End date', '2026-12-18')
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
  })

  it('keeps typed text that matches no place after blur', () => {
    render(<SearchPanel today="2026-11-19" onSearch={vi.fn()} />)
    const dest = screen.getByLabelText('Destination')
    type('Destination', 'Atlantis')
    fireEvent.blur(dest)
    expect(dest).toHaveValue('Atlantis')
  })

  it('suggests matching known places and fills the pick', () => {
    render(<SearchPanel today="2026-11-19" onSearch={vi.fn()} />)
    type('Destination', 'Li')
    const list = screen.getByRole('listbox', { name: 'Matching places' })
    const options = within(list).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['LisbonPortugal', 'LiverpoolUnited Kingdom'])
    fireEvent.click(options[1])
    expect(screen.getByLabelText('Destination')).toHaveValue('Liverpool')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('refuses a start date before today with a message at the field', () => {
    const onSearch = setup('Lisbon', '2026-11-18', '2026-11-25')
    search()
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Start date')).toHaveAccessibleDescription('Start date must be today or later.')
    expect(screen.getByLabelText('End date')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('refuses an end date before the start date with a message at the field', () => {
    const onSearch = setup('Lisbon', '2026-12-10', '2026-12-09')
    search()
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByLabelText('End date')).toHaveAccessibleDescription('End date must be on or after the start date.')
  })

  it('searches with valid input', () => {
    const onSearch = setup()
    search()
    expect(onSearch).toHaveBeenCalledWith({ destination: 'Lisbon', startDate: '2026-12-14', endDate: '2026-12-18', adults: 1, children: 0 })
  })

  it('allows 9 travellers and refuses 10 with a message', () => {
    const onSearch = setup()
    type('Adults', '5')
    type('Children', '4')
    search()
    expect(onSearch).toHaveBeenCalledTimes(1)
    type('Children', '5')
    search()
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Too many travellers')
    type('Children', '4')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

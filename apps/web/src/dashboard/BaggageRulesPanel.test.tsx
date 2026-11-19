import { render, screen } from '@testing-library/react'
import { BAGGAGE_RULES, BaggageRulesPanel } from './BaggageRulesPanel'

describe('BaggageRulesPanel', () => {
  it('shows the static rules', () => {
    render(<BaggageRulesPanel />)
    expect(screen.getByRole('heading', { name: 'Baggage and travel rules' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(BAGGAGE_RULES)
  })
})

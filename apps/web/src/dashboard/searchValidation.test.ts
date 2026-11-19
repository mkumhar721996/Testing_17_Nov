import { canSearch, validateSearch } from './searchValidation'

const valid = { destination: 'Lisbon', startDate: '2026-12-14', endDate: '2026-12-18', adults: 1, children: 0 }
const today = '2026-11-19'

describe('canSearch', () => {
  it('needs destination and both dates', () => {
    expect(canSearch({ ...valid, destination: ' ' })).toBe(false)
    expect(canSearch({ ...valid, startDate: '' })).toBe(false)
    expect(canSearch({ ...valid, endDate: '' })).toBe(false)
    expect(canSearch(valid)).toBe(true)
  })
})

describe('validateSearch', () => {
  it('accepts valid input, including end equal to start and today as start', () => {
    expect(validateSearch(valid, today)).toEqual({})
    expect(validateSearch({ ...valid, startDate: '2026-12-10', endDate: '2026-12-10' }, today)).toEqual({})
    expect(validateSearch({ ...valid, startDate: today }, today)).toEqual({})
  })
  it('refuses a start date before today', () => {
    expect(validateSearch({ ...valid, startDate: '2026-11-18' }, today).startDate).toBe('Start date must be today or later.')
  })
  it('refuses an end date before the start date', () => {
    expect(validateSearch({ ...valid, startDate: '2026-12-10', endDate: '2026-12-09' }, today).endDate).toBe(
      'End date must be on or after the start date.',
    )
  })
  it('allows 9 travellers and refuses 10', () => {
    expect(validateSearch({ ...valid, adults: 5, children: 4 }, today)).toEqual({})
    expect(validateSearch({ ...valid, adults: 5, children: 5 }, today).travellers).toBe(
      'A search covers up to 9 travellers in total. Reduce adults or children and search again.',
    )
  })
})

import { KNOWN_PLACES, matchPlaces } from './places'

const names = (text: string) => matchPlaces(text).map((p) => p.name)

describe('matchPlaces', () => {
  it('matches the start of a name, case-insensitively', () => {
    expect(names('li')).toEqual(['Lisbon', 'Liverpool', 'Berlin'])
    expect(names(' BER ')).toEqual(['Berlin', 'Bergen'])
  })
  it('matches part of a name from the middle', () => {
    expect(names('bon')).toEqual(['Lisbon'])
    expect(names('pool')).toEqual(['Liverpool'])
  })
  it('returns the country with each match', () => {
    expect(matchPlaces('porto')).toEqual([{ name: 'Porto', country: 'Portugal' }])
  })
  it('does not match on the country', () => {
    expect(names('portugal')).toEqual([])
  })
  it('returns nothing for empty, blank or unknown text', () => {
    expect(names('')).toEqual([])
    expect(names('   ')).toEqual([])
    expect(names('zzz')).toEqual([])
  })
  it('offers every known place for a text all of them share', () => {
    expect(KNOWN_PLACES).toHaveLength(7)
    expect(names('e')).toContain('Edinburgh')
  })
})

import { matchPlaces } from './places'

describe('matchPlaces', () => {
  it('matches part of a name, case-insensitively', () => {
    expect(matchPlaces('li').map((p) => p.name)).toEqual(['Lisbon', 'Liverpool'])
    expect(matchPlaces(' BER ').map((p) => p.name)).toEqual(['Berlin', 'Bergen'])
  })
  it('returns nothing for empty or unknown text', () => {
    expect(matchPlaces('')).toEqual([])
    expect(matchPlaces('zzz')).toEqual([])
  })
})

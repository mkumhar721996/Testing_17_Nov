import { validateRadius } from './validate'

describe('validateRadius', () => {
  it.each([
    ['1', 1],
    ['50', 50],
    ['5', 5],
    [' 8 ', 8],
  ])('accepts %j', (input, km) => {
    expect(validateRadius(input)).toEqual({ ok: true, km })
  })

  it.each(['0', '51', '2.5', '', 'abc', '-1', '1e1', '5 km'])('refuses %j', (input) => {
    expect(validateRadius(input)).toEqual({ ok: false })
  })
})

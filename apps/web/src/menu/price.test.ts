import { formatPrice, isValidPrice } from './price'

describe('isValidPrice', () => {
  it.each(['0', '0.00', '-1', '-0.01', '', '1.234', '0.000', 'abc'])('rejects %j', (p) => {
    expect(isValidPrice(p)).toBe(false)
  })

  it.each(['0.01', '7.50', '7.5', '12'])('accepts %j', (p) => {
    expect(isValidPrice(p)).toBe(true)
  })
})

describe('formatPrice', () => {
  it('formats with the restaurant currency', () => {
    expect(formatPrice('7.50', 'USD')).toBe('$7.50')
    expect(formatPrice('8.00', 'EUR')).toContain('€')
  })
})

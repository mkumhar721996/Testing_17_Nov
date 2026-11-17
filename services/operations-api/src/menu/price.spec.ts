import { describe, expect, it } from 'vitest';
import { parsePrice } from './price';

describe('parsePrice', () => {
  it.each(['0', '0.00', '-1', '-0.01', '', ' ', '1.234', '0.000', 'abc', '1e3', '123456789'])(
    'rejects %j',
    (p) => expect(parsePrice(p).ok).toBe(false),
  );

  it.each([undefined, null, 7.5, {}])('rejects non-string %j', (p) =>
    expect(parsePrice(p).ok).toBe(false),
  );

  it('keeps the entered value', () => {
    expect(parsePrice('7.50')).toEqual({ ok: true, price: '7.50' });
    expect(parsePrice('7.5')).toEqual({ ok: true, price: '7.5' });
  });

  it('accepts 0.01', () => {
    expect(parsePrice('0.01')).toEqual({ ok: true, price: '0.01' });
  });
});

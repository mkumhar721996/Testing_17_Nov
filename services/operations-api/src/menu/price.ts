const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export type PriceResult = { ok: true; price: string } | { ok: false; error: string };

/** Prices are decimal strings end to end, never floats: at most two decimals and above zero. */
export function parsePrice(raw: unknown): PriceResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a price.' };
  const value = raw.trim();
  if (!PRICE_PATTERN.test(value) || !/[1-9]/.test(value)) {
    return {
      ok: false,
      error: 'Enter a price greater than zero, with at most two decimal places.',
    };
  }
  return { ok: true, price: value };
}

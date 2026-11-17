const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/

/** Mirrors the API's parsePrice; the server stays authoritative. */
export function isValidPrice(raw: string): boolean {
  const value = raw.trim()
  return PRICE_PATTERN.test(value) && /[1-9]/.test(value)
}

/** Display only: the price travels as a decimal string and is never computed with. */
export function formatPrice(price: string, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(price))
}

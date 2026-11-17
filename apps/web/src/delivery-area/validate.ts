export const MIN_RADIUS_KM = 1
export const MAX_RADIUS_KM = 50

export type RadiusCheck = { ok: true; km: number } | { ok: false }

// Same rule as the API: a whole number of kilometres from 1 to 50.
export function validateRadius(input: string): RadiusCheck {
  const text = input.trim()
  if (!/^\d+$/.test(text)) return { ok: false }
  const km = Number(text)
  return km >= MIN_RADIUS_KM && km <= MAX_RADIUS_KM ? { ok: true, km } : { ok: false }
}

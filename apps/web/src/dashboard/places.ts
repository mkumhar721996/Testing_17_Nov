export type Place = { name: string; country: string }

export const KNOWN_PLACES: Place[] = [
  { name: 'Lisbon', country: 'Portugal' },
  { name: 'Liverpool', country: 'United Kingdom' },
  { name: 'Edinburgh', country: 'United Kingdom' },
  { name: 'Berlin', country: 'Germany' },
  { name: 'Barcelona', country: 'Spain' },
  { name: 'Bergen', country: 'Norway' },
  { name: 'Porto', country: 'Portugal' },
]

export function matchPlaces(text: string): Place[] {
  const q = text.trim().toLowerCase()
  if (!q) return []
  return KNOWN_PLACES.filter((p) => p.name.toLowerCase().includes(q))
}

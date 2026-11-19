export type SearchInput = { destination: string; startDate: string; endDate: string; adults: number; children: number }
export type SearchErrors = { startDate?: string; endDate?: string; travellers?: string }

export const MAX_TRAVELLERS = 9

export function canSearch(i: Pick<SearchInput, 'destination' | 'startDate' | 'endDate'>): boolean {
  return i.destination.trim() !== '' && i.startDate !== '' && i.endDate !== ''
}

/** Dates are ISO yyyy-mm-dd strings, so they compare correctly as text. */
export function validateSearch(i: SearchInput, today: string): SearchErrors {
  const errors: SearchErrors = {}
  if (i.startDate < today) errors.startDate = 'Start date must be today or later.'
  if (i.endDate < i.startDate) errors.endDate = 'End date must be on or after the start date.'
  if (i.adults + i.children > MAX_TRAVELLERS) {
    errors.travellers = `A search covers up to ${MAX_TRAVELLERS} travellers in total. Reduce adults or children and search again.`
  }
  return errors
}

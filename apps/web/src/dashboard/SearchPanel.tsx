import { useId, useState, type FormEvent } from 'react'
import { matchPlaces } from './places'
import { MAX_TRAVELLERS, canSearch, validateSearch, type SearchErrors, type SearchInput } from './searchValidation'

type SearchPanelProps = { today: string; onSearch: (s: SearchInput) => void }

/** An empty or non-numeric count counts as 0. */
const toCount = (v: string) => {
  const n = Number.parseInt(v, 10)
  return Number.isNaN(n) ? 0 : n
}

export function SearchPanel({ today, onSearch }: SearchPanelProps) {
  const id = useId()
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [adults, setAdults] = useState('1')
  const [children, setChildren] = useState('0')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [errors, setErrors] = useState<SearchErrors>({})

  const suggestions = showSuggestions ? matchPlaces(destination) : []
  const listId = `${id}-places`
  const startErrorId = `${id}-start-error`
  const endErrorId = `${id}-end-error`

  function submit(e: FormEvent) {
    e.preventDefault()
    const input: SearchInput = { destination: destination.trim(), startDate, endDate, adults: toCount(adults), children: toCount(children) }
    const found = validateSearch(input, today)
    setErrors(found)
    if (Object.keys(found).length === 0) onSearch(input)
  }

  return (
    <section className="card">
      <h2 className="section-title">Find a trip</h2>
      <form onSubmit={submit} noValidate>
        <div className="fields">
          <div className="field combo">
            <label htmlFor={`${id}-destination`}>Destination</label>
            <input
              id={`${id}-destination`}
              className="input"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value)
                setShowSuggestions(true)
              }}
              onBlur={() => setShowSuggestions(false)}
            />
            {suggestions.length > 0 && (
              <ul id={listId} className="suggestions" role="listbox" aria-label="Matching places">
                {suggestions.map((p) => (
                  <li
                    key={p.name}
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setDestination(p.name)
                      setShowSuggestions(false)
                    }}
                  >
                    {p.name}
                    <small>{p.country}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="dates">
            <div className="field">
              <label htmlFor={`${id}-start`}>Start date</label>
              <input
                id={`${id}-start`}
                type="date"
                className={errors.startDate ? 'input is-invalid' : 'input'}
                value={startDate}
                aria-invalid={errors.startDate ? true : undefined}
                aria-describedby={errors.startDate ? startErrorId : undefined}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {errors.startDate && (
                <p id={startErrorId} className="field-error" role="alert">
                  {errors.startDate}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${id}-end`}>End date</label>
              <input
                id={`${id}-end`}
                type="date"
                className={errors.endDate ? 'input is-invalid' : 'input'}
                value={endDate}
                aria-invalid={errors.endDate ? true : undefined}
                aria-describedby={errors.endDate ? endErrorId : undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
              {errors.endDate && (
                <p id={endErrorId} className="field-error" role="alert">
                  {errors.endDate}
                </p>
              )}
            </div>
          </div>
          <div className="field field-narrow">
            <label htmlFor={`${id}-adults`}>Adults</label>
            <input
              id={`${id}-adults`}
              type="number"
              className="input"
              min={1}
              max={MAX_TRAVELLERS}
              value={adults}
              onChange={(e) => {
                setAdults(e.target.value)
                setErrors((p) => ({ ...p, travellers: undefined }))
              }}
            />
          </div>
          <div className="field field-narrow">
            <label htmlFor={`${id}-children`}>Children</label>
            <input
              id={`${id}-children`}
              type="number"
              className="input"
              min={0}
              max={MAX_TRAVELLERS}
              value={children}
              onChange={(e) => {
                setChildren(e.target.value)
                setErrors((p) => ({ ...p, travellers: undefined }))
              }}
            />
          </div>
        </div>
        {errors.travellers && (
          <div className="alert alert-danger" role="alert">
            <strong>Too many travellers</strong> {errors.travellers}
          </div>
        )}
        <div className="panel-actions">
          <button type="submit" className="btn btn-primary" disabled={!canSearch({ destination, startDate, endDate })}>
            Search
          </button>
        </div>
      </form>
    </section>
  )
}

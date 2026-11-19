import { useState } from 'react'
import { Drawer } from '../components/Drawer'
import type { SectionId } from '../shell/AppShell'
import { BaggageRulesPanel } from './BaggageRulesPanel'
import { SearchPanel } from './SearchPanel'
import type { SearchInput } from './searchValidation'

type DashboardPageProps = {
  onNewBooking: () => void
  onNavigate?: (id: SectionId) => void
  traveller?: { name: string }
  today?: string
}

const MENU = [
  { id: 'overview', label: 'Overview' },
  { id: 'account', label: 'Account' },
  { id: 'operations', label: 'Operations' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'settings', label: 'Settings' },
] as const

const localToday = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/** Home screen: its own header and no footer. It performs no fetch, so the panels never wait on trip data. */
export function DashboardPage({ onNewBooking, onNavigate, traveller, today = localToday() }: DashboardPageProps) {
  const [results, setResults] = useState<SearchInput | null>(null)

  function go(id: (typeof MENU)[number]['id']) {
    if (id === 'overview' || id === 'settings') onNavigate?.(id)
  }

  const travellerCount = results ? results.adults + results.children : 0

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">Travellie</span>
        <nav className="app-menu" aria-label="Main">
          {MENU.map((m) => (
            <a
              key={m.id}
              href="#"
              aria-current={m.id === 'overview' ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                go(m.id)
              }}
            >
              {m.label}
            </a>
          ))}
        </nav>
        {traveller && (
          <div className="app-user">
            <span className="avatar" aria-hidden="true">
              {initials(traveller.name)}
            </span>
            <span>{traveller.name}</span>
          </div>
        )}
      </header>
      <main className="app-main">
        <div className="stack">
          <div className="cluster cluster-between">
            <div>
              <h1 className="page-title">Your travel dashboard</h1>
              <p className="lead">
                {traveller ? `Welcome back, ${traveller.name}. ` : ''}Upcoming trips, bookings and quick search.
              </p>
            </div>
            <button type="button" className="btn btn-primary btn-lg" onClick={onNewBooking}>
              New booking
            </button>
          </div>
          <SearchPanel today={today} onSearch={setResults} />
          <BaggageRulesPanel />
        </div>
      </main>
      {results && (
        <Drawer title="Search results" onClose={() => setResults(null)}>
          <p>
            {results.destination}, {results.startDate} to {results.endDate}, {travellerCount}{' '}
            {travellerCount === 1 ? 'traveller' : 'travellers'}
          </p>
          <ul className="results-list" aria-label="Results" />
        </Drawer>
      )}
    </div>
  )
}

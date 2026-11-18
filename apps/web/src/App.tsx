import { useState } from 'react'
import { Dashboard } from './dashboard/Dashboard'

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'operations', label: 'Operations' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="app-shell">
      <header className="shell-header">
        <button
          className="btn btn-secondary btn-icon btn-lg shell-menu-btn"
          type="button"
          aria-controls="main-nav"
          aria-expanded={menuOpen}
          aria-label="Menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          &#9776;
        </button>
        <a className="shell-brand" href="#">
          Ops Console
        </a>
        <a className="btn btn-ghost btn-lg shell-account" href="#">
          <span className="avatar" aria-hidden="true">
            OP
          </span>{' '}
          Account
        </a>
      </header>
      <div className="shell-body">
        <nav className={`shell-nav${menuOpen ? ' is-open' : ''}`} id="main-nav" aria-label="Main">
          {NAV.map((item) => (
            <a key={item.id} href="#" aria-current={item.id === 'overview' ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <main className="shell-main">
          <div className="shell-content">
            <Dashboard />
          </div>
        </main>
      </div>
      <footer className="shell-footer">Ops Console · Operations API and background worker</footer>
    </div>
  )
}

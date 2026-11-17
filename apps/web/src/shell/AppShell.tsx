import { useState, type ReactNode } from 'react'

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'operations', label: 'Operations' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'settings', label: 'Settings' },
]

interface Props {
  current: string
  children: ReactNode
}

export default function AppShell({ current, children }: Props) {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="app-shell">
      <header className="shell-header">
        <button
          className="btn btn-secondary btn-icon btn-lg shell-menu-btn"
          type="button"
          aria-controls="main-nav"
          aria-expanded={navOpen}
          aria-label="Menu"
          onClick={() => setNavOpen(!navOpen)}
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
        <nav className={navOpen ? 'shell-nav is-open' : 'shell-nav'} id="main-nav" aria-label="Main">
          {NAV.map((entry) => (
            <a
              key={entry.id}
              href="#"
              aria-current={entry.id === current ? 'page' : undefined}
            >
              {entry.label}
            </a>
          ))}
        </nav>
        <main className="shell-main">
          <div className="shell-content">{children}</div>
        </main>
      </div>
      <footer className="shell-footer">Ops Console &middot; Operations API and background worker</footer>
    </div>
  )
}

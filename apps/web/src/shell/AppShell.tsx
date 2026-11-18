import { useState, type ReactNode } from 'react'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'operations', label: 'Operations' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'settings', label: 'Settings' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

export function AppShell({ current, children }: { current: SectionId; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="shell">
      <header className="shell-header">
        <button
          type="button"
          className="btn btn-secondary btn-icon btn-lg shell-menu-btn"
          aria-label="Menu"
          aria-controls="main-nav"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
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
        <nav className={open ? 'shell-nav is-open' : 'shell-nav'} id="main-nav" aria-label="Main">
          {SECTIONS.map((s) => (
            <a key={s.id} href="#" aria-current={s.id === current ? 'page' : undefined}>
              {s.label}
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

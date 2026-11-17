import type { ReactNode } from 'react'

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'operations', label: 'Operations' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'settings', label: 'Settings' },
]

// Navigation links are inert placeholders until routing exists.
export default function AppShell({ current, children }: { current: string; children: ReactNode }) {
  return (
    <div className="app-frame">
      <header className="app-header">
        <span className="app-brand">Ops Console</span>
      </header>
      <div className="app-body">
        <nav className="app-nav" aria-label="Main">
          {sections.map((section) => (
            <a
              key={section.id}
              href="#"
              aria-current={section.id === current ? 'page' : undefined}
              onClick={(event) => event.preventDefault()}
            >
              {section.label}
            </a>
          ))}
        </nav>
        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}

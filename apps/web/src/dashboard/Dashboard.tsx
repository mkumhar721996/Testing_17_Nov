import { formatChange, formatTime } from './format'
import type { MarketOverview } from './types'
import { useMarketOverview } from './useMarketOverview'

const badgeClass = (pct: number) => (pct < 0 ? 'badge badge-danger' : 'badge badge-success')

function Movers({ title, movers }: { title: string; movers: MarketOverview['gainers'] }) {
  return (
    <>
      <h3 className="sub">{title}</h3>
      <ul aria-label={title} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {movers.map((m) => (
          <li key={m.symbol} className="mover">
            <span>{m.symbol}</span>
            <span className={badgeClass(m.changePct)}>{formatChange(m.changePct)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Overview({ data }: { data: MarketOverview }) {
  return (
    <>
      <section className="stats" aria-label="Market stats">
        {data.stats.map((s) => (
          <div key={s.key} className="card">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value">{s.value}</p>
            {s.changePct === null ? (
              <span className="badge badge-neutral">Shares traded today</span>
            ) : (
              <span className={badgeClass(s.changePct)}>{formatChange(s.changePct)}</span>
            )}
          </div>
        ))}
      </section>
      <div className="dash">
        <section className="card" aria-labelledby="top-movers-title">
          <h2 id="top-movers-title" className="section-title">
            Top movers
          </h2>
          <Movers title="Top gainers" movers={data.gainers} />
          <Movers title="Top losers" movers={data.losers} />
        </section>
        <section className="card" aria-label="Market news">
          <h2 className="section-title">Market news</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.news.map((n) => (
              <li key={n.id} className="news-item">
                <p>{n.headline}</p>
                <span className="text-muted text-sm">{formatTime(n.publishedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function Loading() {
  return (
    <div role="status" aria-live="polite">
      <p className="text-muted">Loading market data…</p>
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton sk-stat" />
        ))}
      </div>
      <div className="dash">
        <div className="stack">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton sk-row" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { status, data, retry } = useMarketOverview()

  return (
    <div className="stack">
      <h1 className="page-title">Stock dashboard</h1>
      {status === 'loading' && <Loading />}
      {status === 'error' && (
        <>
          <div className="alert alert-danger" role="alert">
            <span className="alert-title">Market data could not be loaded.</span> Prices may be out of date.
          </div>
          <div className="empty-state">
            <p>We could not reach the market data feed. Check your connection, then try again.</p>
            <button type="button" className="btn btn-secondary" onClick={retry}>
              Try again
            </button>
          </div>
        </>
      )}
      {status === 'ready' && data && <Overview data={data} />}
    </div>
  )
}

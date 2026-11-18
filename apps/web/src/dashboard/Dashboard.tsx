import { changeBadgeClass, formatChange, formatTime } from './format'
import type { MarketOverview } from './types'
import { useMarketOverview } from './useMarketOverview'

function Movers({ id, title, movers }: { id: string; title: string; movers: MarketOverview['gainers'] }) {
  return (
    <>
      <h3 className="sub" id={id}>
        {title}
      </h3>
      <ul className="plain-list" aria-labelledby={id}>
        {movers.map((m) => (
          <li className="mover" key={m.symbol}>
            <span>{m.symbol}</span>
            <span className={changeBadgeClass(m.changePct)}>{formatChange(m.changePct)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Overview({ data }: { data: MarketOverview }) {
  return (
    <div>
      <section className="stats" aria-label="Market stats">
        {data.stats.map((s) => (
          <div className="card" role="group" aria-labelledby={`stat-${s.key}`} key={s.key}>
            <p className="stat-label" id={`stat-${s.key}`}>
              {s.label}
            </p>
            <p className="stat-value">{s.value}</p>
            {s.changePct === null ? (
              <span className="badge badge-neutral">Shares traded today</span>
            ) : (
              <span className={changeBadgeClass(s.changePct)}>{formatChange(s.changePct)}</span>
            )}
          </div>
        ))}
      </section>
      <div className="dash">
        <div className="stack">
          <section className="card" aria-labelledby="top-movers-title">
            <h2 className="section-title" id="top-movers-title">
              Top movers
            </h2>
            <Movers id="top-gainers-title" title="Top gainers" movers={data.gainers} />
            <Movers id="top-losers-title" title="Top losers" movers={data.losers} />
          </section>
          <section className="card" aria-labelledby="market-news-title">
            <h2 className="section-title" id="market-news-title">
              Market news
            </h2>
            <ul className="plain-list">
              {data.news.map((n) => (
                <li className="news-item" key={n.id}>
                  <p>{n.headline}</p>
                  <time className="text-muted text-sm" dateTime={n.publishedAt}>
                    {formatTime(n.publishedAt)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div role="status" aria-live="polite">
      <p className="text-muted">Loading market data…</p>
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton sk-stat" key={i} />
        ))}
      </div>
      <div className="dash">
        <div className="stack">
          {[0, 1, 2, 3].map((i) => (
            <div className="skeleton sk-row" key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

function LoadError({ retry }: { retry: (() => void) | undefined }) {
  return (
    <>
      <div className="alert alert-danger" role="alert">
        <span className="alert-title">Market data could not be loaded.</span> Prices may be out of date.
      </div>
      <div className="empty-state error-state">
        <p>We could not reach the market data feed. Check your connection, then try again.</p>
        <button className="btn btn-secondary" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    </>
  )
}

export function Dashboard() {
  const { status, data, retry } = useMarketOverview()
  return (
    <div className="dashboard">
      <h1 className="page-title">Stock dashboard</h1>
      {status === 'loading' && <Loading />}
      {status === 'error' && <LoadError retry={retry} />}
      {status === 'ready' && <Overview data={data} />}
    </div>
  )
}

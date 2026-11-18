summary: |
  Build the read-only market overview on the dashboard: four stat cards (S&P 500, Nasdaq, Dow, Volume), top movers (exactly two gainers, two losers) and a news list. The data flows vendor -> Background Worker (ADR-0003, settled decision) -> PostgreSQL snapshot tables -> Operations API read endpoint (ADR-0001/0002/0004) -> Web App, which fetches once when the page opens and never polls or offers a refresh or edit control. Chart and watchlist stay out of scope. Work spans all three components (worker sync job, API endpoint plus migration, web dashboard with loading and error states) and wires the design-system tokens into the web app, which does not load them today.
scope:
  - description: |
      Migration for the market snapshot storage. One table `market_snapshot` (single latest row, id = 1, JSONB `payload`, `fetched_at timestamptz`) is enough because the story is read-only and shows only the latest values. Payload shape is the shared `MarketOverview` type below. Add a tiny migration runner script (`pnpm run migrate`) that applies the `.sql` files in order via `pg`, because the repo has no migration tooling yet.
      ```ts
      export interface MarketOverview {
        stats: { key: 'sp500' | 'nasdaq' | 'dow' | 'volume'; label: string; value: string; changePct: number | null }[]
        gainers: { symbol: string; changePct: number }[]   // exactly 2
        losers: { symbol: string; changePct: number }[]    // exactly 2
        news: { id: string; headline: string; publishedAt: string }[]
        asOf: string
      }
      ```
    files:
      - services/operations-api/migrations/001_market_snapshot.sql
      - services/operations-api/scripts/migrate.ts
      - services/operations-api/package.json
    rationale: |
      ADR-0004: only the API and worker touch the database. Market data is global reference data, not tenant-owned, so ADR-0013 tenant_id does not apply to this table (see open questions).
  - description: |
      Worker: a `MarketDataProvider` interface plus an HTTP vendor implementation configured by env (`MARKET_DATA_API_URL`, `MARKET_DATA_API_KEY`), a pure `buildOverview(raw): MarketOverview` mapper (sorts movers, takes top 2 gainers and top 2 losers, formats stats) and a `syncMarketOverview(provider, db)` job that upserts the snapshot row. `main.ts` runs it at startup and on a `MARKET_SYNC_INTERVAL_MS` timer (default 300000). Vendor errors keep the previous snapshot and log; they never write partial data.
      ```ts
      export interface MarketDataProvider { fetchOverview(): Promise<RawMarketData> }
      export function buildOverview(raw: RawMarketData): MarketOverview
      export async function syncMarketOverview(p: MarketDataProvider, db: Pick<Pool, 'query'>): Promise<void>
      ```
    files:
      - services/background-worker/src/market/types.ts
      - services/background-worker/src/market/provider.ts
      - services/background-worker/src/market/build-overview.ts
      - services/background-worker/src/market/sync.ts
      - services/background-worker/src/market/sync.test.ts
      - services/background-worker/src/market/build-overview.test.ts
      - services/background-worker/src/main.ts
      - services/background-worker/package.json
    rationale: |
      The settled decision says a third-party vendor is called by the Background Worker and the result is stored for the API to serve; ADR-0003 forbids vendor calls in API request handlers. The worker has no `pg` dependency yet, so it is added.
  - description: |
      API: new `MarketModule` with `GET /market/overview` returning the stored `MarketOverview` read from `market_snapshot` via the injected `PG_POOL`. Returns 200 with the payload, or 503 with `{ error: 'market data unavailable' }` when no snapshot row exists yet. Read-only: no POST/PUT/PATCH/DELETE routes are added (AC5). Register in `AppModule`. Use explicit `@Inject(PG_POOL)` because vitest/esbuild does not emit decorator metadata (see vitest.config.ts).
      ```ts
      @Controller('market')
      export class MarketController {
        @Get('overview') overview(): Promise<MarketOverview>
      }
      ```
    files:
      - services/operations-api/src/market/market.module.ts
      - services/operations-api/src/market/market.controller.ts
      - services/operations-api/src/market/market.service.ts
      - services/operations-api/src/market/market.controller.spec.ts
      - services/operations-api/src/market/market.types.ts
      - services/operations-api/src/app.module.ts
      - services/operations-api/test/e2e/market.spec.ts
    rationale: |
      ADR-0001/0002: the Web App reads business data only through the API. Mirrors the HealthModule/HealthController layout.
  - description: |
      Web: load design-system tokens and component styles once in the app entry stylesheet. `apps/web/src/index.css` currently holds only `@import "tailwindcss";` and `main.tsx` imports it (line 3). Add imports of `../../../design-system/tokens.css` and `../../../design-system/prototype-utils.css` (defines `.card`, `.badge-success/-danger/-neutral`, `.skeleton`, `.alert`, `.alert-danger`, `.table`, `.stack`, `.cluster`, `.btn`, `.btn-secondary`, `.empty-state`). Add `server.fs.allow: ['../..']` in `vite.config.ts` if the dev server refuses files outside `apps/web`. The page-specific rules the prototype defines inline (`.stats`, `.stat-label`, `.stat-value`, `.dash`, `.mover`, `.news-item`, `.section-title`, `.sub`, `.sk-stat`, `.sk-row`) go into `apps/web/src/dashboard.css`, written only with tokens (`--space-3`, `--space-2`, `--font-size-xl`, `--font-size-sm`, `--font-size-lg`, `--font-weight-semibold`, `--color-fg-muted`, `--color-border-subtle`, `--border-width`). Replace the placeholder `App` with the app shell from the prototype (top bar with brand "Ops Console" and Account link, sidebar Overview/Operations/Jobs/Settings with Overview `aria-current="page"`, footer), and render `<Dashboard />` in the content area (max width `--content-max-width`). Shell classes (`.shell-*`) are defined only inside the prototype, so define them in `dashboard.css` or `shell.css` on the same tokens (also see `design-system/app-shell.html`).
    files:
      - apps/web/src/index.css
      - apps/web/src/dashboard.css
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/vite.config.ts
      - apps/web/e2e/app.spec.ts
    rationale: |
      The design system is not loaded by the app today (verified: index.css is only the tailwind import), so every token and class the design uses would otherwise be undefined. The existing App test and e2e assert the heading 'Web App' and must be updated to the new shell.
  - description: |
      Web: `Dashboard` component and `useMarketOverview` hook. The hook calls `fetch('/market/overview')` exactly once in a `useEffect` on mount (AbortController, client timeout constant `MARKET_LOAD_TIMEOUT_MS = 10000`), returns `{ status: 'loading' | 'ready' | 'error', data }`, and has no interval, no refetch and no exposed `reload` while ready (AC6, 7, 8). Rendering follows the prototype default state: h1 'Stock dashboard'; `<section class="stats" aria-label="Market stats">` of four `.card`s each with `.stat-label`, `.stat-value` and a `.badge` ('▲ +0.8%' success, '▼ −0.2%' danger, Volume neutral 'Shares traded today') so change is never colour-only; a 'Top movers' `.card` (h2 `.section-title`) with 'Top gainers' and 'Top losers' h3 subheadings, each a `ul` of `.mover` rows (symbol plus badge) rendering exactly the two items the API returns; a 'Market news' `.card` with `.news-item` rows (headline plus muted time). Loading state: `role="status"` 'Loading market data…' with four `.skeleton.sk-stat` and `.skeleton.sk-row` rows. Error state: `.alert.alert-danger role="alert"` 'Market data could not be loaded.' plus the prototype's `.empty-state` text, with a 'Try again' `.btn-secondary` shown only in the error state. No inputs or buttons render in the ready state. Layout: `.dash` two-column grid at 64em, one column below, down to 375px.
    files:
      - apps/web/src/dashboard/Dashboard.tsx
      - apps/web/src/dashboard/useMarketOverview.ts
      - apps/web/src/dashboard/format.ts
      - apps/web/src/dashboard/types.ts
      - apps/web/src/dashboard/Dashboard.test.tsx
      - apps/web/src/dashboard/useMarketOverview.test.tsx
      - apps/web/e2e/dashboard.spec.ts
    rationale: |
      Implements AC1-8 against the approved prototype. Watchlist panel, symbol search/Add form, chart panel and period chips drawn in the prototype belong to sibling stories and are NOT rendered here.
tests:
  - |
    AC1 (web, write first, `apps/web/src/dashboard/Dashboard.test.tsx`): with `fetch` mocked to return a fixture overview, after load each stat is shown.
    ```ts
    render(<Dashboard />)
    for (const label of ['S&P 500', 'Nasdaq', 'Dow', 'Volume']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    expect(within(screen.getByLabelText('Market stats')).getAllByRole('group')).toHaveLength(4)
    ```
    Pair with worker test `build-overview.test.ts`: `expect(buildOverview(raw).stats.map(s => s.key)).toEqual(['sp500','nasdaq','dow','volume'])`.
  - |
    AC2 and AC3 (worker, `build-overview.test.ts`): given vendor data with 5 gainers and 5 losers, the mapper keeps exactly the top two of each, ordered by magnitude.
    ```ts
    const o = buildOverview(rawWithManyMovers)
    expect(o.gainers).toHaveLength(2)
    expect(o.losers).toHaveLength(2)
    expect(o.gainers.every(g => g.changePct > 0)).toBe(true)
    expect(o.losers.every(l => l.changePct < 0)).toBe(true)
    ```
    Web (`Dashboard.test.tsx`): `expect(within(await screen.findByRole('list', { name: 'Top gainers' })).getAllByRole('listitem')).toHaveLength(2)` and the same for 'Top losers'.
  - |
    AC4 (web): `expect(within(await screen.findByRole('region', { name: 'Market news' })).getAllByRole('listitem').length).toBeGreaterThan(0)`. API (`market.controller.spec.ts`): the controller returns the stored snapshot's `news` array unchanged.
  - |
    AC5 (web and API): in the ready state there is nothing to edit.
    ```ts
    await screen.findByText('Market news')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    ```
    API e2e `market.spec.ts`: `for (const m of ['post','put','patch','delete']) expect((await request[m]('/market/overview')).status()).toBe(404)`.
  - |
    AC6 (web, `useMarketOverview.test.tsx`): data loads on mount with no user action and fetch is called once.
    ```ts
    render(<Dashboard />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading market data')
    await screen.findByText('Top movers')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/market/overview', expect.anything())
    ```
    Also covers error: fetch rejects -> `expect(await screen.findByRole('alert')).toHaveTextContent('Market data could not be loaded.')`. API: `market.controller.spec.ts` returns 503 when the snapshot table is empty. Worker `sync.test.ts`: a vendor failure leaves `db.query` uncalled (previous snapshot kept) and a success upserts once.
  - |
    AC7 (web): `expect(screen.queryByRole('button', { name: /refresh|reload|update/i })).toBeNull()` after load. The 'Try again' button exists only in the error state: `expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()` in the ready state.
  - |
    AC8 (web, fake timers): values stay unchanged and no refetch happens as time passes.
    ```ts
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Dashboard />)
    await screen.findByText('4,512.30')
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(screen.getByText('4,512.30')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    ```
  - |
    Playwright e2e (`apps/web/e2e/dashboard.spec.ts`, API mocked with `page.route('**/market/overview', ...)`): open `/`, expect the four stat labels, two gainers, two losers and a news list without any click, and `expect(page.getByRole('button', { name: /refresh/i })).toHaveCount(0)`. Update `apps/web/e2e/app.spec.ts` and `App.test.tsx` from the 'Web App' heading to the new shell heading 'Stock dashboard'.
  - |
    Narrow commands per task (derived from the project command): `(cd services/background-worker && pnpm exec vitest run src/market)`, `(cd services/operations-api && pnpm exec vitest run src/market)`, `(cd apps/web && pnpm exec vitest run src/dashboard src/App.test.tsx)`. Run the full project test command once at the end.
assumptions_or_open_questions:
  - |
    Load timeout (open project question from CHORE-040): no figure was given. The plan uses a 10 s client-side timeout constant (`MARKET_LOAD_TIMEOUT_MS`) after which the error state shows. Please confirm or change it.
  - |
    Availability: ADR-0007 sets 99.5% of business hours (08:00-18:00 local, Mon-Fri) for the system. Because the page reads a stored snapshot, a vendor outage only makes the data stale (it does not make the page fail); no extra availability work is planned.
  - |
    The vendor is not named (only 'a third-party market data vendor'). The plan codes against a `MarketDataProvider` interface with an env-configured HTTP implementation, so the real vendor's response shape needs a mapping adapter once chosen. Provisioning the vendor account and API key is outside the repo.
  - |
    AC7 versus the prototype: AC7 says no refresh control on the overview, and the prototype's error state shows a 'Try again' button. The plan keeps 'Try again' only in the error state (the loaded overview has no refresh control) and flags it so the reviewer can drop it if AC7 should also cover errors.
  - |
    The prototype also draws the watchlist panel, symbol search and 'Add to watchlist' form, S&P 500 chart panel with period chips and a watchlist-empty state. The story's scope says chart and watchlist are separate stories, so none of those are built here.
  - |
    Authorization: ADR-0011 says every API request is authorized against the caller's role, but the repo has no authentication or role code yet (Cognito wiring, ADR-0005). The plan adds the endpoint without an auth guard and assumes the guard lands globally later. Please confirm.
  - |
    Tenancy: ADR-0013 requires tenant_id on tenant-owned tables. Market data is shared across tenants, so `market_snapshot` carries no tenant_id. Please confirm it is not tenant-owned.
  - |
    `design-system/tokens.css` contains `--duration-fast: [object Object]` and `--duration-spin: [object Object]` (lines 63-64), which are invalid CSS values, so `.skeleton` shimmer and `.btn` transitions will not animate. No token covers a valid duration; the plan does not hardcode one. The token file needs fixing separately.
  - |
    The worker refresh interval (default 5 minutes) is a guess. It only affects how fresh the stored snapshot is on the next page open, because the page itself never refreshes (AC8).
  - |
    A refresh interval also means two page opens a few minutes apart can show different values; AC8 only requires stability within one open page.
estimated_points: 8
package_dependencies:
  - name: pg
    version: ^8.13.0
    ecosystem: npm
    rationale: The Background Worker writes the market snapshot to the shared PostgreSQL. It has no database client today (the Operations API already uses pg ^8.13.0).
    component_id: comp_background_worker
  - name: "@types/pg"
    version: ^8.11.10
    ecosystem: npm
    rationale: Type declarations for pg in the worker (TypeScript), matching the API's existing version.
    component_id: comp_background_worker
notes: |
  ### Data & rollout

  - **Existing data**: new table only (`market_snapshot`); no existing table or row is altered. Until the worker's first successful sync the table is empty and the API answers 503, so the web app shows its error state rather than invented data.
  - **Backfill / seed**: no seed. The worker runs a sync at startup, which fills the table; the upsert on id = 1 is idempotent and safe to re-run.
  - **Settings**: `MARKET_DATA_API_URL` and `MARKET_DATA_API_KEY` (worker; no default, sync is skipped with a log line when unset), `MARKET_SYNC_INTERVAL_MS` (worker; default 300000), `DATABASE_URL` (already used by the API; now also read by the worker). Document them in a new `services/background-worker/.env.example`. The web app needs no new setting; it calls the API through a same-origin `/market/overview` path (dev proxy or reverse proxy), which the implementer must confirm against how the API is exposed.
  - **Provisioning**: a vendor account/API key, and the migration applied to the RDS database before the worker or API start (`cd services/operations-api && pnpm run migrate`).
  - **Order and rollback**: migrate, then deploy API (reads the table), then worker (writes it), then web. Rollback: redeploy the previous web/API/worker images; the table can stay in place unused, or be removed with `DROP TABLE market_snapshot` (add as a commented down section in the .sql file).

  Findings from the code: `apps/web/src/index.css` imports only tailwindcss and `main.tsx` line 3 imports it, so tokens and the design-system classes are not loaded yet. The API (NestJS 11, `PG_POOL` global provider in `database.module.ts`, `HealthModule` as the pattern) and worker (plain `node:http` in `server.ts`, no db) have no migrations or scheduler. Vitest for the API only includes `src/**/*.spec.ts`; web only `src/**/*.test.{ts,tsx}`, so `scripts/migrate.ts` is not unit-tested.

  ```mermaid
  flowchart TD
    Vendor[Market data vendor] --> Sync[worker market/sync.ts]
    Main[worker main.ts] --> Sync
    Sync --> Build[worker market/build-overview.ts]
    Sync --> DB[(PostgreSQL market_snapshot)]
    Ctrl[api market.controller.ts] --> Svc[api market.service.ts]
    Svc --> Pool[api database.module.ts PG_POOL]
    Pool --> DB
    AppMod[api app.module.ts] --> Ctrl
    Hook[web useMarketOverview.ts] -->|GET /market/overview| Ctrl
    Dash[web Dashboard.tsx] --> Hook
    AppTsx[web App.tsx shell] --> Dash
    MainTsx[web main.tsx] --> AppTsx
    Css[web index.css] --> Tokens[design-system tokens.css and prototype-utils.css]
    classDef touched fill:#f96,color:#000
    class Sync,Main,Build,Ctrl,Svc,AppMod,Hook,Dash,AppTsx,Css touched
  ```
review_focus: |
  IN: market overview only (four stats, two gainers, two losers, news), loaded once on open, read-only, no refresh or edit controls, plus the worker sync, snapshot table and API read endpoint behind it. OUT: chart, watchlist, symbol search and period chips that the prototype also draws. Riskiest parts are the data pipeline (vendor mapping and the 503-until-first-sync behaviour) and wiring design-system CSS from outside `apps/web`. Deliberate: 'Try again' exists only in the error state, no tenant_id on the snapshot table and no auth guard yet (both flagged as open questions), and the invalid `--duration-*` tokens are not worked around.

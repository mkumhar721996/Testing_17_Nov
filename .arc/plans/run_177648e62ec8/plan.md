summary: |
  Build the read-only market overview on the dashboard: four stat cards (S&P 500, Nasdaq, Dow, Volume), top movers (exactly two gainers, two losers) and a news list. Data flows vendor -> Background Worker (ADR-0003, settled decision) -> PostgreSQL `market_snapshot` -> Operations API `GET /market/overview` (ADR-0001/0002/0004) -> Web App, which fetches once when the dashboard opens and never polls, refreshes or offers edit controls. Chart, watchlist, symbol search and period chips drawn in the prototype are separate stories and are not built. Work spans all three components. Re-verified against the current tree: the design tokens, `prototype-utils.css`, the app shell (`AppShell`) and the API migration runner (`src/database/migrate.ts`) already exist, so this plan reuses them instead of adding them.
scope:
  - description: |
      Migration `002_market_snapshot.sql` in the existing `services/operations-api/migrations/` folder (001 is `001_employee_records.sql`); it is applied by the existing runner (`pnpm run migrate` -> `src/database/migrate.ts`, which applies `.sql` files in name order and records them in `schema_migrations`). No new runner.
      ```sql
      create table market_snapshot (
        id smallint primary key check (id = 1),
        payload jsonb not null,
        fetched_at timestamptz not null default now()
      );
      -- down: drop table market_snapshot;
      ```
      One row (id = 1) holds the latest `MarketOverview` because the story shows only current values. Shared type, copied (not imported) into worker `src/market/types.ts` and API `src/market/market.types.ts`:
      ```ts
      export interface MarketOverview {
        stats: { key: 'sp500' | 'nasdaq' | 'dow' | 'volume'; label: string; value: string; changePct: number | null }[]
        gainers: { symbol: string; changePct: number }[]  // exactly 2
        losers: { symbol: string; changePct: number }[]   // exactly 2
        news: { id: string; headline: string; publishedAt: string }[]
        asOf: string
      }
      ```
    files:
      - services/operations-api/migrations/002_market_snapshot.sql
    rationale: |
      ADR-0004 (only API and worker touch the database). Market data is global reference data, so no `tenant_id` (open question on ADR-0013).
  - description: |
      Background Worker: add `pg` (and `@types/pg`). Create a `MarketDataProvider` interface, an HTTP vendor implementation configured by env (`MARKET_DATA_API_URL`, `MARKET_DATA_API_KEY`), a pure `buildOverview` mapper and a `syncMarketOverview` job; `main.ts` runs it at startup and every `MARKET_SYNC_INTERVAL_MS` (default 300000) next to the existing `createApp().listen(...)`. A vendor error keeps the previous snapshot and logs; partial data is never written. The worker is ESM (`"type": "module"`), so relative imports end in `.js`.
      ```ts
      export interface MarketDataProvider { fetchOverview(): Promise<RawMarketData> }
      export function buildOverview(raw: RawMarketData): MarketOverview
      export async function syncMarketOverview(p: MarketDataProvider, db: Pick<Pool, 'query'>): Promise<void>
      // upsert: insert into market_snapshot (id, payload, fetched_at) values (1, $1, now())
      //         on conflict (id) do update set payload = excluded.payload, fetched_at = excluded.fetched_at
      ```
      `buildOverview` returns stats in the order sp500, nasdaq, dow, volume; top 2 gainers (changePct > 0, largest first) and top 2 losers (changePct < 0, most negative first); throws if fewer than two of either, so a bad vendor answer is never stored.
    files:
      - services/background-worker/package.json
      - services/background-worker/src/market/types.ts
      - services/background-worker/src/market/provider.ts
      - services/background-worker/src/market/build-overview.ts
      - services/background-worker/src/market/build-overview.test.ts
      - services/background-worker/src/market/sync.ts
      - services/background-worker/src/market/sync.test.ts
      - services/background-worker/src/main.ts
      - services/background-worker/.env.example
    rationale: |
      Settled decision: a third-party vendor is called by the Background Worker and stored for the API to serve; ADR-0003 forbids vendor calls in request handlers. The worker has no database client or scheduler today.
  - description: |
      Operations API: new `MarketModule` mirroring `HealthModule`, with a read-only `GET /market/overview` that returns the stored payload, or 503 when no snapshot row exists yet. Guarded with the existing `SignedInGuard` (from `../auth/hr.guard`) like `GET /departments`, so ADR-0011 holds; `PG_POOL` comes from the global `DatabaseModule`. Use explicit `@Inject(...)` (vitest/esbuild emits no decorator metadata). No POST/PUT/PATCH/DELETE routes (AC5). Register `MarketModule` in `AppModule` imports.
      ```ts
      @Controller('market')
      export class MarketController {
        constructor(@Inject(MarketService) private readonly market: MarketService) {}
        @Get('overview') @UseGuards(SignedInGuard) overview(): Promise<MarketOverview>
      }
      // MarketService.overview(): select payload from market_snapshot where id = 1;
      // no row -> throw new ApiError(503, 'MARKET_DATA_UNAVAILABLE', 'Market data is not available yet')
      ```
      503 uses the project's `ApiError` (`src/common/api-error.ts`) so the body is `{ code, message }` like the other endpoints.
    files:
      - services/operations-api/src/market/market.types.ts
      - services/operations-api/src/market/market.service.ts
      - services/operations-api/src/market/market.controller.ts
      - services/operations-api/src/market/market.module.ts
      - services/operations-api/src/market/market.controller.spec.ts
      - services/operations-api/src/app.module.ts
      - services/operations-api/test/e2e/market.spec.ts
    rationale: |
      ADR-0001/0002: the Web App reads business data only through the API. e2e follows `test/e2e/departments.spec.ts` (skipped without `DATABASE_URL`, principal passed via `x-user-id`, `x-tenant-id`, `x-roles` headers).
  - description: |
      Web data layer: `api/market.ts` with `getMarketOverview(signal)` over the existing `apiFetch` (`apps/web/src/api/client.ts`, base `/api`, JSON, throws `ApiError`); add an optional `signal?: AbortSignal` to its `Init` and pass it to `fetch`. `useMarketOverview` calls it exactly once in a mount `useEffect` (AbortController plus a `MARKET_LOAD_TIMEOUT_MS = 10000` timeout), returns `{ status: 'loading' | 'ready' | 'error', data, retry }`; it has no interval and no refetch while ready. `retry` exists only to power the error-state button and re-runs the load only from `error`.
      ```ts
      export const MARKET_LOAD_TIMEOUT_MS = 10000
      export function useMarketOverview(): { status: 'loading' | 'ready' | 'error'; data: MarketOverview | null; retry: () => void }
      ```
      `format.ts` holds `formatChange(pct)` -> '▲ +0.8%' / '▼ −0.2%' (real minus sign, as in the prototype) and `formatTime(iso)` -> '9:15 AM'.
    files:
      - apps/web/src/api/client.ts
      - apps/web/src/api/market.ts
      - apps/web/src/dashboard/types.ts
      - apps/web/src/dashboard/format.ts
      - apps/web/src/dashboard/useMarketOverview.ts
      - apps/web/src/dashboard/useMarketOverview.test.tsx
    rationale: |
      AC6 (load on open with no action), AC7 and AC8 (no refresh, values static) are properties of this hook. Reuses the project's API client rather than a bare `fetch`.
  - description: |
      Web UI, built from the approved prototype's default, loading and error states (design file `TESTING-17-NOV-STORY-041-design.html`, screen "Stock dashboard"). `Dashboard.tsx` renders: `h1.page-title` 'Stock dashboard'; `section.stats[aria-label="Market stats"]` of four `.card`s, each `p.stat-label`, `p.stat-value`, and a `.badge` (`badge-success` '▲ +0.8%', `badge-danger` '▼ −0.2%', Volume `badge-neutral` 'Shares traded today') so change is never colour-only; `.dash` grid holding a 'Top movers' `section.card` (`h2.section-title`, `h3.sub` 'Top gainers' / 'Top losers', each a `ul` named by `aria-label` with `li.mover` = symbol + badge) and a 'Market news' `section.card` (`aria-label="Market news"`, `li.news-item` = `p` headline + `span.text-muted.text-sm` time). Loading: `role="status" aria-live="polite"` 'Loading market data…' with four `.skeleton.sk-stat` and `.skeleton.sk-row` blocks inside `.stats` / `.dash` (UI guidelines: skeletons for loading cards and lists). Error: `.alert.alert-danger[role=alert]` with `.alert-title` 'Market data could not be loaded.' plus `.empty-state` text 'We could not reach the market data feed. Check your connection, then try again.' and a `btn btn-secondary` 'Try again' (verb + object guideline noted; wording kept from the prototype). The ready state contains no button, input or link-as-control.
      Page-specific rules from the prototype's inline `<style>` go in a new `apps/web/src/styles/dashboard.css`, imported once from `apps/web/src/index.css` after `./styles/app.css`, using only tokens: `.stats` (grid, `--space-3` gap, `repeat(auto-fit, minmax(min(100%, var(--dropdown-min-width)), 1fr))`), `.stat-value` (`--font-size-xl`, `--font-weight-semibold`), `.stat-label` (`--color-fg-muted`, `--font-size-sm`), `.dash` (one column; two columns `minmax(0,1fr) var(--toast-width)` from `64em`, `--space-4` top margin), `.mover`, `.news-item`, `.sub` (`--space-3`, `--space-1`, `--font-size-md`, `--border-width`, `--color-border-subtle`, `--space-2`), `.sk-row` (`--space-4`), `.sk-stat` (`--space-6`). `.page-title` and `.section-title` already exist in `styles/app.css`; `.card`, `.badge-*`, `.alert*`, `.empty-state`, `.skeleton`, `.stack`, `.text-muted`, `.text-sm` come from `design-system/prototype-utils.css` (already imported in `index.css` lines 2-3 via the `@design-system` alias).
      Wiring: `AppShell` (`apps/web/src/shell/AppShell.tsx`, nav links are inert `href="#"`) gets an optional `onNavigate(id: SectionId)` called on nav-link click (preventDefault). `App.tsx` gains a `section` state: 'overview' (default) renders `<Dashboard />` with `current="overview"`; 'settings' renders the existing employee/departments views with `current="settings"`; other sections keep rendering the dashboard-less placeholder behaviour they have today (none). Update `App.test.tsx` (first test now opens Settings first) and `e2e/app.spec.ts` (heading 'Stock dashboard').
    files:
      - apps/web/src/dashboard/Dashboard.tsx
      - apps/web/src/dashboard/Dashboard.test.tsx
      - apps/web/src/styles/dashboard.css
      - apps/web/src/index.css
      - apps/web/src/shell/AppShell.tsx
      - apps/web/src/shell/AppShell.test.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/e2e/app.spec.ts
      - apps/web/e2e/dashboard.spec.ts
    rationale: |
      AC1-AC8 against the approved design. Existing components Modal and Toast are not needed (no confirmation or action feedback in a read-only overview). Responsive: stats reflow with auto-fit and `.dash` collapses to one column below 64em, down to a 375px phone, and the shell already collapses its sidebar below 48em.
tests:
  - |
    AC1 - web (write first, `apps/web/src/dashboard/Dashboard.test.tsx`, `./api/market` mocked to a fixture): all four stats show after load.
    ```ts
    render(<Dashboard />)
    for (const label of ['S&P 500', 'Nasdaq', 'Dow', 'Volume']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    expect(within(screen.getByLabelText('Market stats')).getAllByText(/./, { selector: '.stat-label' })).toHaveLength(4)
    ```
    Worker (`build-overview.test.ts`): `expect(buildOverview(raw).stats.map(s => s.key)).toEqual(['sp500','nasdaq','dow','volume'])`.
  - |
    AC2 and AC3 - worker (`build-overview.test.ts`), vendor data with 5 gainers and 5 losers keeps exactly the top two of each:
    ```ts
    const o = buildOverview(rawWithManyMovers)
    expect(o.gainers).toHaveLength(2)
    expect(o.losers).toHaveLength(2)
    expect(o.gainers.every(g => g.changePct > 0)).toBe(true)
    expect(o.losers.every(l => l.changePct < 0)).toBe(true)
    expect(() => buildOverview(rawWithOneLoser)).toThrow()
    ```
    Web (`Dashboard.test.tsx`):
    ```ts
    expect(within(await screen.findByRole('list', { name: 'Top gainers' })).getAllByRole('listitem')).toHaveLength(2)
    expect(within(screen.getByRole('list', { name: 'Top losers' })).getAllByRole('listitem')).toHaveLength(2)
    ```
  - |
    AC4 - web: `expect(within(await screen.findByRole('region', { name: 'Market news' })).getAllByRole('listitem').length).toBeGreaterThan(0)`. API (`market.controller.spec.ts`, fake pool returning one row): `expect((await controller.overview()).news).toEqual(stored.news)`.
  - |
    AC5 - web, ready state has nothing to edit:
    ```ts
    await screen.findByText('Market news')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    ```
    API e2e (`test/e2e/market.spec.ts`): `for (const m of ['post','put','patch','delete'] as const) expect((await request[m]('/market/overview', { headers: signedIn })).status()).toBe(404)`.
  - |
    AC6 - web (`useMarketOverview.test.tsx`): loads on mount without any action, one request.
    ```ts
    render(<Dashboard />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading market data')
    await screen.findByText('Top movers')
    expect(getMarketOverview).toHaveBeenCalledTimes(1)
    ```
    Error state: `getMarketOverview` rejects -> `expect(await screen.findByRole('alert')).toHaveTextContent('Market data could not be loaded.')`. Timeout: with fake timers and a never-resolving mock, `await vi.advanceTimersByTimeAsync(MARKET_LOAD_TIMEOUT_MS)` shows the alert. API (`market.controller.spec.ts`): empty `market_snapshot` -> `await expect(controller.overview()).rejects.toMatchObject({ status: 503 })`. API e2e: unauthenticated GET -> 401. Worker (`sync.test.ts`): provider rejects -> `expect(db.query).not.toHaveBeenCalled()`; success -> `expect(db.query).toHaveBeenCalledTimes(1)` with an `on conflict (id)` statement.
  - |
    AC7 - web: `expect(screen.queryByRole('button', { name: /refresh|reload|update/i })).toBeNull()` after load, and `expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()` in the ready state; in the error state `expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()` and clicking it calls `getMarketOverview` a second time.
  - |
    AC8 - web, fake timers: values stay and nothing is refetched as time passes.
    ```ts
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Dashboard />)
    await screen.findByText('4,512.30')
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(screen.getByText('4,512.30')).toBeInTheDocument()
    expect(getMarketOverview).toHaveBeenCalledTimes(1)
    ```
  - |
    App wiring (`App.test.tsx`, `AppShell.test.tsx`): `render(<App />)` shows `heading { name: 'Stock dashboard' }` with `link Overview` `aria-current="page"`; clicking the Settings link shows the 'New employee record' heading and the existing departments flow tests keep passing; `onNavigate` is called with 'settings' on click.
  - |
    Playwright e2e (`apps/web/e2e/dashboard.spec.ts`, API mocked with `page.route('**/api/market/overview', ...)`): open `/`, expect the four stat labels, two gainers, two losers and the news list with no click, and `await expect(page.getByRole('button', { name: /refresh/i })).toHaveCount(0)`. `apps/web/e2e/app.spec.ts` heading changes from 'Web App' to 'Stock dashboard'.
  - |
    Narrow commands per task (derived from the project test command): `(cd services/background-worker && pnpm exec vitest run src/market)`, `(cd services/operations-api && pnpm exec vitest run src/market)`, `(cd apps/web && pnpm exec vitest run src/dashboard src/shell src/App.test.tsx)`. Run the full project test command once at the end.
assumptions_or_open_questions:
  - |
    Load timeout (open project question from CHORE-040): no figure given. The plan uses a 10 s client-side timeout (`MARKET_LOAD_TIMEOUT_MS`) before the error state shows. Please confirm or change.
  - |
    Availability: ADR-0007 sets 99.5% of business hours (08:00-18:00 local, Mon-Fri). Because the page reads a stored snapshot, a vendor outage makes data stale rather than failing the page; no extra availability work is planned.
  - |
    The vendor is not named (only 'a third-party market data vendor'). The plan codes to a `MarketDataProvider` interface with an env-configured HTTP implementation; the real response shape needs a mapping adapter once chosen. Vendor account and API key provisioning is outside the repo.
  - |
    AC7 versus the prototype: AC7 says no refresh control on the overview, while the prototype's error state has a 'Try again' button. The plan keeps 'Try again' only in the error state; drop it if AC7 should cover errors too.
  - |
    Sign-in: `GET /market/overview` uses `SignedInGuard` (ADR-0011) like `GET /departments`, but the web client sends no token yet (`getAccessToken()` returns null in `api/client.ts`, sign-in is a separate story). Until it lands the real dashboard will show its error state against a guarded API, same as the existing employee pages. Please confirm the guard should stay (the alternative is an unguarded endpoint, which breaks ADR-0011).
  - |
    Tenancy: ADR-0013 requires `tenant_id` on tenant-owned tables. Market data is shared across tenants, so `market_snapshot` has none. Please confirm it is not tenant-owned.
  - |
    Landing page: `App.tsx` today opens the employee record under Settings. The plan makes Overview (the dashboard) the default and adds click navigation to Settings through `AppShell`'s new `onNavigate`; the existing App tests are updated accordingly. Please confirm the dashboard should be the default view.
  - |
    Prototype scope: the prototype also draws the watchlist panel, symbol search / 'Add to watchlist', S&P 500 chart with period chips and the watchlist-empty state. The story says chart and watchlist are separate stories, so none of them is built here; the shell's page title row therefore has no search form.
  - |
    Token gaps: `design-system/tokens.css` lines 63-64 define `--duration-fast` and `--duration-spin` as `[object Object]` (invalid), so `.skeleton` shimmer and `.btn` transitions will not animate; no valid duration token exists and none is hardcoded. The prototype's literal `320px` side column and `200px` stat minimum have no exact tokens; the plan uses `--toast-width` (320px) and `--dropdown-min-width` (180px). Please confirm or add layout tokens.
  - |
    The worker refresh interval (default 5 minutes) is a guess; it only affects freshness on the next page open, since an open page never refreshes (AC8).
estimated_points: 8
package_dependencies:
  - name: pg
    version: ^8.13.0
    ecosystem: npm
    component_id: comp_background_worker
    rationale: The Background Worker writes the market snapshot to the shared PostgreSQL and has no database client today (the Operations API already uses pg ^8.13.0).
  - name: "@types/pg"
    version: ^8.11.10
    ecosystem: npm
    component_id: comp_background_worker
    rationale: Type declarations for pg in the worker, matching the API's version.
notes: |
  ### Data & rollout

  - **Existing data**: new table only (`market_snapshot`); no existing table or row is altered. Until the worker's first successful sync the table is empty and the API answers 503, so the web app shows its error state rather than invented data.
  - **Backfill / seed**: none. The worker syncs at startup, filling the table; the upsert on id = 1 is idempotent and safe to re-run.
  - **Settings**: `MARKET_DATA_API_URL` and `MARKET_DATA_API_KEY` (worker; no default, the sync is skipped with a log line when unset), `MARKET_SYNC_INTERVAL_MS` (worker; default 300000), `DATABASE_URL` (already used by the API; the worker now reads it too). Documented in a new `services/background-worker/.env.example`. The web app needs no new setting; it already calls the API at `VITE_API_BASE_URL` or `/api`.
  - **Provisioning**: a vendor account and API key, and the migration applied to the RDS database before the worker or API start (`cd services/operations-api && pnpm run migrate`).
  - **Order and rollback**: migrate, then API (reads the table), then worker (writes it), then web. Rollback: redeploy the previous images; the table can stay unused, or be removed with `drop table market_snapshot` (kept as a comment in the .sql file).

  Findings from the code: `apps/web/src/index.css` already imports tailwind, `@design-system/tokens.css`, `@design-system/prototype-utils.css` and `./styles/app.css`; `vite.config.ts` has the `@design-system` alias and `server.fs.allow`; `styles/app.css` already defines the `.shell-*` classes, `.page-title` and `.section-title`. `AppShell` marks `current` with `aria-current="page"`. The API has `AuthModule` (`SignedInGuard`, `HrGuard`, header-based principal resolver), `ApiError`, a migration runner and `migrations/001_employee_records.sql`.

  ```mermaid
  flowchart TD
    Vendor[Market data vendor] --> Sync[worker market/sync.ts]
    Main[worker main.ts] --> Sync
    Sync --> Build[worker market/build-overview.ts]
    Sync --> DB[(PostgreSQL market_snapshot)]
    Mig[api migrations/002_market_snapshot.sql] --> DB
    Ctrl[api market.controller.ts] --> Guard[api auth/hr.guard.ts SignedInGuard]
    Ctrl --> Svc[api market.service.ts]
    Svc --> Pool[api database.module.ts PG_POOL]
    Pool --> DB
    AppMod[api app.module.ts] --> Ctrl
    Client[web api/client.ts apiFetch] -->|GET /market/overview| Ctrl
    Hook[web useMarketOverview.ts] --> Client
    Dash[web Dashboard.tsx] --> Hook
    AppTsx[web App.tsx] --> Dash
    AppTsx --> Shell[web shell/AppShell.tsx]
    Css[web index.css] --> DashCss[web styles/dashboard.css]
    classDef touched fill:#f96,color:#000
    class Sync,Main,Build,Ctrl,Svc,AppMod,Mig,Client,Hook,Dash,AppTsx,Shell,Css,DashCss touched
  ```
review_focus: |
  IN: market overview only (four stats, two gainers, two losers, news), loaded once on open, read-only, no refresh or edit control on the loaded overview, plus the worker sync, `market_snapshot` migration and guarded API read endpoint behind it. OUT: chart, watchlist, symbol search and period chips that the prototype also draws. Riskiest parts are the vendor-to-snapshot pipeline (mapping, never storing partial data, 503 until the first sync) and the App/AppShell change that makes Overview the default view. Deliberate: 'Try again' exists only in the error state, `market_snapshot` has no `tenant_id`, the endpoint uses `SignedInGuard` although the web client sends no token yet, and the invalid `--duration-*` tokens are not worked around.

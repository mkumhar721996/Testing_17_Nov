summary: |
  Add a read-only, sign-in-protected sample-data API to the operations API (NestJS) that serves everything the Stock SIP Dashboard and IPO Detail screens need for the single sample investor: portfolio summary, growth and returns series for 1M/1Y/All, one allocation snapshot for today, the SIP list, exactly 3 gainers + 3 losers, the open-IPO list and IPO detail. The data is static in-code fixtures (a real source is out of scope), identical for every signed-in user. A new bearer-token guard validates Amazon Cognito tokens (ADR-0005) and returns 401 for anyone without a valid sign-in. Today the API has only `/health`, no auth and no dashboard code, so the guard is part of this item. Screens are not built here; this item only supplies the data they will call.
scope:
  - description: |
      Sample-data fixtures, one typed module, single investor INV-0001 "Meera Iyer" (values taken from the approved design's embedded sample JSON, `#sample-data`). Dates are ISO strings, money is integer rupees, percentages are numbers (formatting is the screens' job).
      ```ts
      export type ChartRange = '1m' | '1y' | 'all';
      export interface PortfolioSummary { investorId: string; investorName: string; value: number; invested: number; returns: number; returnsPct: number; nextSip: { amount: number; date: string } }
      export interface SeriesPoint { date: string; value: number }
      export interface Sip { id: string; investorId: string; fund: string; amount: number; nextDate: string; status: 'Active' | 'Paused' }
      export interface Mover { name: string; changePct: number }
      export interface Ipo { id: string; name: string; sector: string; status: 'open' | 'closed' | 'upcoming'; priceBandLow: number; priceBandHigh: number; lotSize: number; opensOn: string; closesOn: string; issueSizeCrore: number; allotmentOn: string; listing: string; minInvestment: number }
      ```
      Fixture contents: summary 482310/420000/62310/14.8, next SIP 5000 on 2026-12-01; four SIPs (Nifty 50 Index Fund, Bluechip Equity Fund, Midcap Growth Fund, Gold ETF paused), each carrying investorId INV-0001; allocation equity 55, debt 25, gold 12, cash 8 (sums to 100) dated 2026-11-17; gainers Tata Motors/Infosys/HDFC Bank, losers Adani Ports/Wipro/Sun Pharma; IPOs Skyline Logistics (open), Greenleaf Foods (open) plus one closed and one upcoming IPO so the open-only filter is genuinely exercised; growth and returns series for all three ranges (growth last point equals summary value, returns last point equals summary returns).
    files:
      - services/operations-api/src/dashboard/sample-data.ts
    rationale: Static, deterministic fixtures keep the sample reproducible and trivially replaceable later by a real source behind the same service.
  - description: |
      `DashboardService` (plain class, `@Injectable()`), pure reads over the fixtures; the controller depends only on it so a real source can replace the fixtures later.
      ```ts
      getPortfolio(): PortfolioSummary
      getGrowth(range: ChartRange): SeriesPoint[]
      getReturns(range: ChartRange): SeriesPoint[]
      getAllocation(): { asOf: string; slices: { asset: string; pct: number }[] }
      listSips(): Sip[]
      getMarketMovers(): { gainers: Mover[]; losers: Mover[] }
      listOpenIpos(): Ipo[]            // status === 'open' only
      getIpo(id: string): Ipo          // throws NotFoundException unless the IPO is open
      ```
    files:
      - services/operations-api/src/dashboard/dashboard.service.ts
    rationale: Keeps data access and the open-only rule out of the HTTP layer.
  - description: |
      `DashboardController`, `@Controller('dashboard')` guarded by `@UseGuards(AuthGuard)` at class level (so every route returns 401 without a valid sign-in, including the chart routes). Routes:
      - `GET /dashboard/portfolio` returns the summary
      - `GET /dashboard/charts/growth?range=1m|1y|all` and `GET /dashboard/charts/returns?range=...` return `{ range, points }`; missing or unknown range returns 400 (a `ParseEnumPipe`-style check, not a silent default)
      - `GET /dashboard/charts/allocation` returns the single snapshot (no range parameter)
      - `GET /dashboard/sips` returns the SIP list (no server-side search, see open questions)
      - `GET /dashboard/market-movers` returns `{ gainers, losers }`
      - `GET /dashboard/ipos` returns open IPOs only, `GET /dashboard/ipos/:id` returns the detail, 404 for an unknown or not-open id
      Responses are identical for every caller; the handlers never read the caller identity. `DashboardModule` is added to `AppModule.imports` (existing file `app.module.ts` is the only prior-history file touched, last changed in PR #6).
    files:
      - services/operations-api/src/dashboard/dashboard.controller.ts
      - services/operations-api/src/dashboard/dashboard.module.ts
      - services/operations-api/src/app.module.ts
    rationale: Thin HTTP layer following the existing health controller/module layout; ADR-0002 (all reads through the operations API).
  - description: |
      Auth guard validating the Cognito-issued bearer token (ADR-0005; credentials stay with the identity provider). The verifier is behind an injectable token so tests substitute a fake and no network or real pool is needed.
      ```ts
      export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
      export interface TokenVerifier { verify(token: string): Promise<{ sub: string }> }
      @Injectable()
      export class AuthGuard implements CanActivate {
        constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}
        async canActivate(ctx: ExecutionContext): Promise<boolean> // throws UnauthorizedException (401) when the Authorization header is missing, not "Bearer <token>", or verify() rejects
      }
      ```
      `CognitoTokenVerifier` wraps `CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId })` from `aws-jwt-verify`, reading `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`. Explicit `@Inject(...)` is required because vitest/esbuild does not emit decorator metadata (see vitest.config.ts). The guard fails closed: if the env vars are unset the verifier rejects every token, so the API returns 401 rather than serving data unauthenticated.
    files:
      - services/operations-api/src/auth/auth.guard.ts
      - services/operations-api/src/auth/cognito-token.verifier.ts
      - services/operations-api/src/auth/auth.module.ts
    rationale: No auth exists in the API yet and AC11 requires 401; ADR-0005 says the API validates the identity provider's tokens. Role mapping and per-role authorization (ADR-0011) are not needed because AC10 says every signed-in user gets the same data.
  - description: |
      Document the two new env vars with safe fail-closed defaults and add an e2e test that runs against the real app (Playwright config already exists).
    files:
      - services/operations-api/test/e2e/dashboard-auth.spec.ts
      - services/operations-api/package.json
    rationale: Proves the deployed wiring returns 401 with no token. `package.json` gains the `aws-jwt-verify` dependency (installed by the platform from `package_dependencies`).
tests:
  - |
    AC1, `src/dashboard/dashboard.service.spec.ts` (write first, fails until the service exists):
    ```ts
    const s = new DashboardService();
    const p = s.getPortfolio();
    expect(p).toMatchObject({ value: 482310, invested: 420000, returns: 62310 });
    expect(p.nextSip).toEqual({ amount: 5000, date: '2026-12-01' });
    expect(p.value - p.invested).toBe(p.returns);
    ```
  - |
    AC2 and AC3, same spec, parameterised over every range:
    ```ts
    it.each(['1m', '1y', 'all'] as const)('growth and returns series for %s', (r) => {
      expect(s.getGrowth(r).length).toBeGreaterThan(1);
      expect(s.getReturns(r).length).toBeGreaterThan(1);
    });
    expect(s.getGrowth('all').at(-1)!.value).toBe(s.getPortfolio().value);
    ```
    Controller-level: `GET /dashboard/charts/growth?range=5y` returns 400 and a missing range returns 400.
  - |
    AC4:
    ```ts
    const a = s.getAllocation();
    expect(a.asOf).toBe('2026-11-17');
    expect(a.slices.reduce((t, x) => t + x.pct, 0)).toBe(100);
    expect(Array.isArray(a)).toBe(false); // one snapshot, not one per range
    ```
    HTTP: `GET /dashboard/charts/allocation` ignores any `range` query and returns the same body.
  - |
    AC5:
    ```ts
    expect(s.listSips().length).toBeGreaterThan(0);
    expect(s.listSips().map((x) => x.fund)).toContain('Nifty 50 Index Fund');
    ```
  - |
    AC6:
    ```ts
    const m = s.getMarketMovers();
    expect(m.gainers).toHaveLength(3);
    expect(m.losers).toHaveLength(3);
    expect(m.gainers.every((g) => g.changePct > 0)).toBe(true);
    expect(m.losers.every((l) => l.changePct < 0)).toBe(true);
    ```
  - |
    AC7, with the closed and upcoming fixtures present:
    ```ts
    const open = s.listOpenIpos();
    expect(open.map((i) => i.id).sort()).toEqual(['greenleaf', 'skyline']);
    expect(open.every((i) => i.status === 'open')).toBe(true);
    ```
  - |
    AC8:
    ```ts
    for (const i of s.listOpenIpos()) expect(s.getIpo(i.id).id).toBe(i.id);
    expect(() => s.getIpo('does-not-exist')).toThrow(NotFoundException);
    expect(() => s.getIpo(closedIpoId)).toThrow(NotFoundException);
    ```
  - |
    AC9:
    ```ts
    const id = s.getPortfolio().investorId;
    expect(id).toBe('INV-0001');
    expect(s.listSips().every((x) => x.investorId === id)).toBe(true);
    ```
  - |
    AC10, `src/dashboard/dashboard.controller.spec.ts` builds a Nest app with `TOKEN_VERIFIER` overridden to a fake that accepts tokens "a" and "b" (different `sub`) and calls each route on a listening ephemeral port with `fetch`:
    ```ts
    for (const path of ['/dashboard/portfolio', '/dashboard/sips', '/dashboard/market-movers', '/dashboard/ipos']) {
      const ra = await (await fetch(base + path, { headers: { Authorization: 'Bearer a' } })).json();
      const rb = await (await fetch(base + path, { headers: { Authorization: 'Bearer b' } })).json();
      expect(rb).toEqual(ra);
    }
    ```
  - |
    AC11, `src/auth/auth.guard.spec.ts` plus the controller spec. Missing header, `Basic x`, `Bearer ` with a rejected token, and malformed token each give 401 on every route, while the fake accepts a good token:
    ```ts
    for (const path of ['/dashboard/portfolio', '/dashboard/sips', '/dashboard/market-movers', '/dashboard/ipos', '/dashboard/ipos/skyline']) {
      expect((await fetch(base + path)).status).toBe(401);
      expect((await fetch(base + path, { headers: { Authorization: 'Bearer bad' } })).status).toBe(401);
    }
    expect((await fetch(base + '/dashboard/portfolio', { headers: { Authorization: 'Bearer a' } })).status).toBe(200);
    ```
    Guard unit test: `await expect(guard.canActivate(ctxWithoutHeader)).rejects.toBeInstanceOf(UnauthorizedException)`.
  - |
    e2e (Playwright, `test/e2e/dashboard-auth.spec.ts`), run via `cd services/operations-api && pnpm run e2e`:
    ```ts
    test('GET /dashboard/portfolio without a token is 401', async ({ request }) => {
      expect((await request.get('/dashboard/portfolio')).status()).toBe(401);
    });
    ```
    Narrow unit command while iterating: `cd services/operations-api && pnpm exec vitest run src/dashboard src/auth`; the full configured command is run by the platform, not by the implementer.
assumptions_or_open_questions:
  - |
    Seeding (deferred question): the sample data is static in-code fixtures, not database rows, so no migration, seed script or tenant_id column is needed. A single hard-coded investor means ADR-0013 tenant scoping is not exercised; revisit when a real source arrives.
  - |
    Failure and empty responses (deferred question): the ACs do not ask for a switch to force errors or empty lists, so none is built. Screens can test their error state by mocking the API or using the 401 path, and the empty IPO state by the future real source. If the reviewer wants a demo switch (for example a `?scenario=error|empty` query or an env flag), that is a small addition and should be decided before code.
  - |
    SIP search (deferred question): assumed to filter on the device over the full list returned by `GET /dashboard/sips` (a single investor has a handful of SIPs, and no AC covers a server query). The design also shows the no-match state "No SIPs match" with a clear-search action, matching the settled project decision. The 'Add your first SIP' empty state for a user with no SIPs is a screen concern; the sample investor always has SIPs.
  - |
    Refresh frequency and monitoring/logging for a future real source (project-wide open questions) are out of scope: the data is static. No caching headers are added.
  - |
    Auth: assumed Cognito access tokens are validated with the `aws-jwt-verify` package against `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`. Neither value is set anywhere I could find in the repo, so the real pool ids must be supplied at deploy time. If a different token format or an existing auth story is meant to supply the guard, the auth scope item should be dropped in favour of it.
  - |
    Route names, the `range` values (`1m`, `1y`, `all`) and field names are my choice, since the item gives none. Dates are ISO strings, money integer rupees; the design shows formatted strings such as "1 Dec 2026" and "₹ 14,760", which the screens must format. The design's per-IPO fields (band, lot, opens, closes, size, allotment, listing, minimum) are all kept so IPO Detail can render.
  - |
    The prototype's design context includes states (loading, error, 401, empty) and screens. Those screens are not built in this item, because the item's text scopes it to serving the data through the API. The screens belong to the sibling stories of the parent epic.
  - |
    "Open for application" is modelled by a fixed `status` field on each IPO rather than by comparing dates with the clock, so tests do not depend on today's date. The design's two open IPOs (open 17 to 20 Nov and 18 to 23 Nov 2026) will look stale after those dates; that is acceptable for placeholder data.
estimated_points: 5
package_dependencies:
  - name: aws-jwt-verify
    version: ^4.0.1
    ecosystem: npm
    component_id: comp_operations_api
    rationale: Verifies Amazon Cognito JWTs in the auth guard (ADR-0005), so the API can return 401 for callers without a valid sign-in. Not currently a dependency of the operations API.
notes: |
  ### Data & rollout
  - **Existing data**: None. No schema, migration or stored data changes; the fixtures live in code.
  - **Backfill / seed**: None. The seed is the code-resident `sample-data.ts`, read-only and trivially idempotent.
  - **Settings**: `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`, both required for any signed-in call. Unset means every token is rejected (401, fail closed). Document them in a short comment on `cognito-token.verifier.ts`; no `.env.example` was verified to exist.
  - **Provisioning**: a Cognito user pool and app client (managed service `comp_identity_provider`) must exist, and its ids must be supplied to the operations-api container.
  - **Order and rollback**: deploy with the env vars set. Rollback is reverting the code. There is no data to undo, and the new routes are additive.

  ### Findings
  - `services/operations-api` today has `AppModule` (DatabaseModule, HealthModule), `HealthController` and a unit spec, plus a Playwright `test/e2e/health.spec.ts`. There is no auth and no dashboard code. Vitest includes only `src/**/*.spec.ts` and esbuild does not emit decorator metadata, so every constructor dependency uses an explicit `@Inject(...)`.
  - The approved design (`TESTING-17-NOV-STORY-026-design.html`) is a UI prototype whose `#sample-data` JSON defines the investor, summary, SIPs, movers and IPOs. Those values seed the fixtures. No UI code is planned here, so no design-system or token work is in scope.

  ```mermaid
  flowchart TD
    Main[main.ts] --> App[app.module.ts]
    App --> Health[HealthModule]
    App --> Dash[DashboardModule]
    Dash --> Ctl[DashboardController]
    Ctl --> Guard[AuthGuard]
    Guard --> Ver[CognitoTokenVerifier]
    Ctl --> Svc[DashboardService]
    Svc --> Data[sample-data.ts]
    classDef touched fill:#f96,color:#000
    class App,Dash,Ctl,Guard,Ver,Svc,Data touched
  ```
  `app.module.ts` is modified to import the new module; the other highlighted nodes are new.
review_focus: |
  IN: read-only sample-data endpoints for one investor and a Cognito bearer-token guard that returns 401. OUT: the dashboard and IPO screens, any real data source, database tables, SIP creation, and server-side search. The riskiest part is the guard, which is new and must fail closed when its env vars are unset. Open-IPO filtering uses a fixed `status` field on purpose, and one closed and one upcoming fixture IPO exist only to prove the filter.

summary: |
  Add read-only, sign-in-protected dashboard endpoints to the Operations API (NestJS) that serve static in-memory placeholder data for one investor: portfolio summary, growth and returns series for 1M/1Y/All, one allocation snapshot, SIP list, 3 gainers + 3 losers, open-only IPO list, and IPO detail. Every endpoint sits behind a bearer-token guard that returns 401 without a valid Cognito token (ADR-0005/0011); every signed-in user receives the same data. No database, no real data source. This story is API-only: the approved prototype (Stock SIP Dashboard and IPO Detail) is built by the web stories, and its sample data (investor INV-0001, summary 482310/420000/62310/14.8%, four SIPs, three gainers and losers, IPOs Skyline Logistics and Greenleaf Foods, allocation equity 55 / debt 25 / gold 12 / cash 8) seeds the fixtures so the screens render the same demo values.
scope:
  - description: |
      Auth guard. The API has no auth today (Glob of services/operations-api/src shows only app, database, health and main). Add a `TokenVerifier` interface (injected by token `TOKEN_VERIFIER`), a Cognito-backed implementation with no new package (Node built-ins only: `node:crypto` `createPublicKey({ key: jwk, format: 'jwk' })` + `verify('RSA-SHA256', ...)` for the RS256 signature, and the global `fetch` for the pool's JWKS at `https://cognito-idp.<region>.amazonaws.com/<poolId>/.well-known/jwks.json`, cached in memory). It checks signature, `iss` equal to the pool issuer, `exp` not passed, `token_use` of `access` or `id`, and `aud`/`client_id` equal to `COGNITO_CLIENT_ID`, rejecting `alg` other than RS256. It is configured by `COGNITO_USER_POOL_ID` (region taken from its prefix) and `COGNITO_CLIENT_ID` (fail closed: if either is unset, every token is rejected), and `AuthGuard` that reads `Authorization: Bearer <token>`, calls `verify`, and throws `UnauthorizedException` (401) on a missing/malformed header or a verifier rejection. Health stays unguarded because the guard is applied per controller, not via APP_GUARD.
      ```ts
      export interface TokenVerifier { verify(token: string): Promise<{ sub: string }>; }
      export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
      ```
      Constructors use explicit `@Inject(...)` (vitest.config.ts note: esbuild emits no decorator metadata).
    files:
      - services/operations-api/src/auth/token-verifier.ts
      - services/operations-api/src/auth/cognito-token-verifier.ts
      - services/operations-api/src/auth/auth.guard.ts
      - services/operations-api/src/auth/auth.module.ts
    rationale: AC 11 needs a real 401 path, and ADR-0005 says the API validates Identity Provider tokens. An injectable verifier lets tests sign in without Cognito.
  - description: |
      Sample data fixtures, one typed module, camelCase fields, ISO dates, INR numbers. Values follow the approved prototype's sample data:
      - investor `investorId: 'INV-0001'`
      - summary `portfolioValue: 482310, investedAmount: 420000, returns: 62310, returnsPercent: 14.8, nextSip: { amount: 5000, date: '2026-12-01' }`
      - growth and returns series keyed by range `'1M' | '1Y' | 'All'`, each non-empty and ending at today's value
      - one allocation snapshot with `asOf` (today's ISO date from an injectable clock, default `new Date()`) and slices equity 55, debt 25, gold 12, cash 8
      - four SIPs, each `{ id, investorId, fundName, amount, nextDate, status }` (status Active or Paused)
      - exactly 3 gainers and 3 losers `{ symbol, name, changePercent }` (signed numbers)
      - IPOs `{ id, name, sector, status, priceBandLow, priceBandHigh, lotSize, opensOn, closesOn, issueSizeCrore, allotmentOn, listing, minInvestment }`: `skyline` and `greenleaf` with status `open`, plus one `upcoming` and one `closed` IPO that the list must exclude.
    files:
      - services/operations-api/src/dashboard/sample-data.ts
      - services/operations-api/src/dashboard/dashboard.types.ts
    rationale: Seeding is static in-process fixtures, which answers the deferred seeding question without a migration or DB. Matching the prototype's values means the web stories can render the approved design unchanged.
  - description: |
      `DashboardService` (pure functions over the fixtures) and `DashboardController` with `@UseGuards(AuthGuard)`:
      ```
      GET /dashboard/portfolio                  -> { investorId, summary }
      GET /dashboard/charts/growth?range=       -> { range, series: [{ date, value }] }
      GET /dashboard/charts/returns?range=      -> { range, series: [{ date, value }] }
      GET /dashboard/charts/allocation          -> { asOf, slices: [{ assetClass, percent, value }] }
      GET /dashboard/sips                       -> { investorId, sips: [...] }
      GET /dashboard/market-movers              -> { asOf, gainers: [3], losers: [3] }
      GET /dashboard/ipos                       -> { ipos: [...open only] }
      GET /dashboard/ipos/:id                   -> IPO detail (404 for unknown id)
      ```
      `range` must be one of 1M, 1Y, All, otherwise `BadRequestException` (400). Allocation takes no range. The IPO list filters `status === 'open'`. Wire `DashboardModule` and `AuthModule` into `AppModule` (src/app.module.ts currently imports DatabaseModule and HealthModule).
    files:
      - services/operations-api/src/dashboard/dashboard.service.ts
      - services/operations-api/src/dashboard/dashboard.controller.ts
      - services/operations-api/src/dashboard/dashboard.module.ts
      - services/operations-api/src/app.module.ts
    rationale: One controller keeps the screens' data needs behind a single guarded surface; routes are read-only so no audit entry is needed under ADR-0011 (state changes only).
  - description: |
      Document `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` in a short README section (no .env file edits). No dependency is added, so package.json is untouched.
    files:
      - services/operations-api/README.md
    rationale: Env vars are the only config; unset means fail closed.
tests:
  - |
    AC11 (write first) in src/auth/auth.guard.spec.ts: guard rejects missing header, non-Bearer header and a verifier that throws.
    ```ts
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(ctx({ authorization: 'Bearer bad' }))).rejects.toBeInstanceOf(UnauthorizedException);
    ```
  - |
    AC11 Cognito verifier in src/auth/cognito-token-verifier.spec.ts (no network: the JWKS fetch is injected, tokens are signed in the test with a generated RSA key via `generateKeyPairSync('rsa', { modulusLength: 2048 })`): a valid token resolves with its `sub`; tampered signature, expired, wrong issuer, wrong client, `alg: none` and unset config all reject.
    ```ts
    await expect(verifier.verify(signed({ sub: 'u1' }))).resolves.toEqual({ sub: 'u1' });
    await expect(verifier.verify(signed({ sub: 'u1', exp: past }))).rejects.toThrow();
    await expect(verifier.verify(noneAlg)).rejects.toThrow();
    ```
  - |
    AC11 over HTTP in src/dashboard/dashboard.http.spec.ts (Nest app from `Test.createTestingModule` with `TOKEN_VERIFIER` overridden, `app.listen(0)`, global `fetch`): every route in the dashboard controller (portfolio, charts, sips, market-movers, ipos, ipos/:id) with no token returns 401, and `/health` still returns 200 without a token.
    ```ts
    for (const p of paths) expect((await fetch(base + p)).status).toBe(401);
    ```
  - |
    AC1 portfolio summary:
    ```ts
    const body = await get('/dashboard/portfolio');
    expect(body.summary).toEqual(expect.objectContaining({
      portfolioValue: expect.any(Number), investedAmount: expect.any(Number),
      returns: expect.any(Number), nextSip: expect.objectContaining({ date: expect.any(String), amount: expect.any(Number) }) }));
    ```
  - |
    AC2 growth for each range:
    ```ts
    for (const r of ['1M', '1Y', 'All']) { const b = await get(`/dashboard/charts/growth?range=${r}`); expect(b.range).toBe(r); expect(b.series.length).toBeGreaterThan(0); }
    expect((await rawGet('/dashboard/charts/growth?range=5Y')).status).toBe(400);
    ```
  - |
    AC3 returns for each range, same shape as AC2 against `/dashboard/charts/returns?range=`.
  - |
    AC4 allocation is a single snapshot for today:
    ```ts
    const b = await get('/dashboard/charts/allocation');
    expect(b.asOf).toBe(today); expect(Array.isArray(b.slices)).toBe(true); expect(b).not.toHaveProperty('range');
    ```
  - |
    AC5 SIP list: `expect(body.sips.length).toBeGreaterThan(0)` and each has id, fundName, amount, nextDate, status.
  - |
    AC6 market movers: `expect(body.gainers).toHaveLength(3); expect(body.losers).toHaveLength(3);` plus gainers have positive changePercent and losers negative.
  - |
    AC7 open IPOs only: `expect(body.ipos.length).toBeGreaterThan(0); expect(body.ipos.every(i => i.status === 'open')).toBe(true);` and the fixture's upcoming and closed IPO ids are absent.
  - |
    AC8 detail for every listed IPO: for each `i` in the list, `expect((await get(`/dashboard/ipos/${i.id}`)).id).toBe(i.id)`; unknown id gives 404.
  - |
    AC9 single investor: `expect(new Set([portfolio.investorId, sips.investorId, ...sips.sips.map(s => s.investorId)]).size).toBe(1)`.
  - |
    AC10 same data for every user: two verifiers resolving different `sub` values (`user-a`, `user-b`) both get responses with `toEqual` identical bodies for portfolio, sips, market-movers and ipos.
  - |
    Playwright e2e in test/e2e/dashboard.spec.ts (existing e2e lives in test/e2e/health.spec.ts): unauthenticated GET on each dashboard route returns 401 against the built server (no Cognito env set, so it also proves fail-closed). Authenticated flows are covered by the vitest HTTP spec.
assumptions_or_open_questions:
  - |
    No UI step: this story is the API only. The approved prototype is the web stories' design, and its inline sample data was used only to choose fixture values and field coverage (the API itself is in scope because the story's text asks for the data to be served). The prototype's loading, error and 401 states and the SIP search empty row belong to the web stories.
  - |
    The prototype formats values for display (for example "₹ 312 to ₹ 328", "1 Dec 2026", "+4.2%"). The API returns raw numbers and ISO dates, and the web app formats them; a reviewer may want to confirm this split.
  - |
    Settled by the person: the route paths in scope are approved as written, and all response fields use camelCase, with one contract shared by frontend and backend.
  - |
    The person asked to remove the `aws-jwt-verify` dependency. The plan now adds no package: the Cognito verifier uses `node:crypto` and global `fetch`. Hand-written JWT checking is security-sensitive, so the verifier spec covers the rejection cases; the trade-off is that we own that code. Alternative if preferred: ship only the guard plus a fail-closed placeholder verifier and leave real Cognito verification to the follow-up integration story.
  - |
    Unclear: the request said "remove this dependency and add any more". I read it as removing `aws-jwt-verify` and adding no other package. If a different package was meant to be added, name it and I will revise.
  - |
    `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` come later when the auth infrastructure is provisioned, and real end-to-end sign-in validation is a follow-up integration story. Until then tests use a stub verifier (the repo has none today, so the builder adds one in the specs); the guard still returns 401 as AC 11 requires.
  - |
    Settled by the person: ADR-0013 tenant scoping is not applied for this story (single sample investor); revisit with multi-tenant requirements or a real data source.
  - |
    Settled by the person, though the message was cut off after its first lines: no failure or empty trigger mechanism, query parameter or custom header is added. Seeding is static in-code fixtures. Please resend anything the rest of that answer added.
  - |
    Still open: SIP search. The plan assumes no server-side search (full SIP list returned, filtering on the device, which is what the prototype does, with the settled 'No SIPs match your search' behaviour in the web story).
  - |
    Still open and out of scope here: refresh frequency and freshness of dashboard data, and monitoring/logging once a real source replaces the sample. Responses are static, so no caching or logging is planned.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: None — no schema, migration or stored data; fixtures live in code.
  - **Backfill / seed**: None needed; fixtures are static and load with the module.
  - **Settings**: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`; unset means every protected route returns 401 (safe default). Documented in services/operations-api/README.md.
  - **Provisioning**: A Cognito user pool and app client must exist before signed-in calls work in a deployed environment; not created by this story.
  - **Order and rollback**: No ordering constraint; roll back by reverting the commit (health route is unaffected).

  Builder first step: run `cd services/operations-api && pnpm install && pnpm run typecheck && pnpm run test` to get the baseline, as the baseline (no new package is installed). Note `vitest.config.ts` includes only `src/**/*.spec.ts`, so keep the HTTP specs under src/ and leave e2e under test/e2e (Playwright, config in playwright.config.ts).

  ```mermaid
  flowchart TD
    Main[src/main.ts] --> App[app.module.ts]
    App --> Health[HealthModule]
    App --> Db[DatabaseModule]
    App --> Auth[AuthModule - new]
    App --> Dash[DashboardModule - new]
    Dash --> Ctl[DashboardController - new]
    Ctl --> Guard[AuthGuard - new]
    Guard --> Ver[TokenVerifier - Cognito]
    Ctl --> Svc[DashboardService - new]
    Svc --> Data[sample-data.ts - new]
    classDef touched fill:#f96,color:#000
    class App,Auth,Dash,Ctl,Guard,Ver,Svc,Data touched
  ```
review_focus: |
  IN: read-only sample-data endpoints in services/operations-api with a bearer-token guard; OUT: DB, real data source, search, failure/empty triggers, caching, and the web screens (no UI is built here). Riskiest part is the guard: it must fail closed and be applied to every dashboard route but not /health. Routes and camelCase field names are an approved contract the web stories depend on, and the fixtures deliberately mirror the approved prototype's sample values; the absence of ADR-0013 tenant scoping is deliberate for one sample investor.

summary: |
  Let a restaurant manager build and maintain one restaurant's fixed-price menu (sections, and items with name, optional description and one price) end to end. The repo is greenfield for this domain: the Operations API has only a health route and a lazy pg Pool, the Web App is a placeholder heading, and there is no auth, tenant, restaurant, migration or audit code. The plan therefore adds, test-first, (1) PostgreSQL tables and plain SQL migrations, (2) a NestJS menu module with manager-only write endpoints, strict price validation, an append-only audit entry per change, tenant scoping, and a public read endpoint that serves the currency and saved values (ACs 12-15), (3) a Cognito-token auth guard that maps users to restaurant managers (ADR-0005), and (4) the "Manage menu" React screen from the approved prototype using the design-system tokens and component stylesheet.

scope:
  - description: |
      Migrations and schema. Add plain SQL migrations plus a tiny runner (no new dependency; uses the existing pg Pool). Tables, all with tenant_id (ADR-0013):
      restaurants(id uuid pk, tenant_id uuid not null, name text not null, currency char(3) not null check (currency ~ '^[A-Z]{3}$'));
      restaurant_managers(tenant_id uuid not null, restaurant_id uuid not null references restaurants, user_sub text not null, primary key (restaurant_id, user_sub));
      menu_sections(id uuid pk, tenant_id, restaurant_id references restaurants, name text not null, position int not null default 0);
      menu_items(id uuid pk, tenant_id, restaurant_id, section_id references menu_sections, name text not null, description text not null default '', price numeric(10,2) not null check (price > 0), position int not null default 0);
      audit_log(id bigserial pk, tenant_id, actor_sub text not null, action text not null, entity text not null, entity_id uuid, detail jsonb, at timestamptz not null default now()).
      The audit table is append-only: the migration revokes UPDATE and DELETE from the app role where one is used, and the code only ever INSERTs (ADR-0004).
      The DB check constraints are a second line of defence; the API validates first.
    files:
      - services/operations-api/migrations/0001_menu.sql
      - services/operations-api/src/database/migrate.ts
      - services/operations-api/package.json
    rationale: |
      No schema or migration tooling exists. A price column of numeric(10,2) stores exactly what the manager typed (AC 13, 19, 20) with no float rounding.
  - description: |
      Caller identity and authorization (ADR-0002, 0005, 0011). AuthGuard reads the Bearer token, calls an injected TokenVerifier (Cognito implementation using aws-jwt-verify, configured by COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID; with either unset every request is rejected 401, fail closed) and sets request.caller = { sub, tenantId }. ManagerGuard/ManagerService check that restaurant_managers has (restaurant_id, caller sub, caller tenant) and otherwise throw 403 with no detail about whether the restaurant exists, so a non-manager (AC 10) and a manager of another restaurant (AC 11) get the same refusal. Signature:
      export interface TokenVerifier { verify(token: string): Promise<{ sub: string; tenantId: string }> }
      export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
      Providers use explicit @Inject(...) because vitest/esbuild does not emit decorator metadata (see services/operations-api/vitest.config.ts).
    files:
      - services/operations-api/src/auth/auth.module.ts
      - services/operations-api/src/auth/auth.guard.ts
      - services/operations-api/src/auth/token-verifier.ts
      - services/operations-api/src/auth/cognito-token-verifier.ts
      - services/operations-api/src/auth/auth.guard.spec.ts
    rationale: Every API request is authorized against the caller's role (ADR-0011) and credentials live only in the Identity Provider (ADR-0005).
  - description: |
      Menu module in the Operations API. Routes (manager-only unless noted):
      POST   /restaurants/:rid/menu/sections          body { name }
      PATCH  /restaurants/:rid/menu/sections/:sid     body { name }
      DELETE /restaurants/:rid/menu/sections/:sid     409 when the section has items (AC 16), 204 when empty (AC 17)
      POST   /restaurants/:rid/menu/sections/:sid/items   body { name, description?, price }
      PATCH  /restaurants/:rid/menu/items/:iid        body { name?, description?, price? }
      DELETE /restaurants/:rid/menu/items/:iid
      GET    /restaurants/:rid/menu                   public read for customers and the manager screen: { restaurant: { id, name, currency }, sections: [{ id, name, items: [{ id, name, description, price }] }] }
      Price is sent and returned as a decimal STRING, never a JS number, so 7.50 stays "7.50". Pure validator:
      export function parsePrice(raw: unknown): { ok: true; price: string } | { ok: false; error: string }
      accepting only /^\d{1,8}(\.\d{1,2})?$/ with value greater than 0 (rejects 0, 0.00, negatives, 0.000, 1.234, empty, non-strings; accepts 0.01 and 7.5). Name is trimmed and must be non-empty (AC 6); description is optional and defaults to '' (AC 21); missing price is rejected (AC 7). Failed validation returns 400 with { errors: { name?: string, price?: string } } and writes nothing. Each write runs in one transaction that also INSERTs an audit_log row. Every query includes tenant_id and restaurant_id; item and section ids are always resolved through the restaurant (an item id from restaurant B under restaurant A's URL is a 404). The GET reads from the database on every request with no caching, so saved edits and removals show on the next load (AC 14, 15). The module depends on a MenuRepository interface (pg implementation plus an in-memory fake for unit tests).
      No size, extra, option or import fields or routes exist (AC 8, 9): DTOs reject unknown properties (400).
    files:
      - services/operations-api/src/menu/menu.module.ts
      - services/operations-api/src/menu/menu.controller.ts
      - services/operations-api/src/menu/menu.service.ts
      - services/operations-api/src/menu/menu.repository.ts
      - services/operations-api/src/menu/pg-menu.repository.ts
      - services/operations-api/src/menu/price.ts
      - services/operations-api/src/menu/price.spec.ts
      - services/operations-api/src/menu/menu.service.spec.ts
      - services/operations-api/src/app.module.ts
    rationale: Business reads and writes, authorization and audit go through the API only (ADR-0001, 0002, 0004, 0011).
  - description: |
      API end-to-end tests (Playwright request fixture, existing test/e2e pattern) against the built API with a real PostgreSQL via DATABASE_URL, a test TokenVerifier selected by an E2E-only env var (E2E_FAKE_AUTH=1, honoured only when NODE_ENV is not production), and a seed of two restaurants in different tenants with one manager each. Update playwright.config.ts to pass DATABASE_URL and run migrations before starting the server.
    files:
      - services/operations-api/test/e2e/menu.spec.ts
      - services/operations-api/test/e2e/seed.ts
      - services/operations-api/playwright.config.ts
    rationale: The unit tests use a fake repository, so only e2e proves the SQL, transactions, tenant scoping and the customer read path.
  - description: |
      Load the design system once in the Web App entry stylesheet. In apps/web/src/index.css add, after the tailwind import, imports of design-system/tokens.css (the token names such as --space-3, --color-primary) and design-system/prototype-utils.css (defines .btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-sm, .card, .stack, .cluster, .cluster-between, .field, .field-hint, .field-error, .input, .textarea, .is-invalid, .alert-*, .empty-state, .skeleton, .text-muted, .text-sm; verified present in that file). Allow the out-of-root path in apps/web/vite.config.ts via server.fs.allow if the dev server blocks it. Today index.css holds only the tailwind import, so nothing loads the tokens yet. Also add the prototype's small page-local rules (.menu-item, .menu-item-text, .menu-item-side, .price, .section-card, .form-card) to the app on the same tokens, copied from the prototype's inline style block.
    files:
      - apps/web/src/index.css
      - apps/web/vite.config.ts
    rationale: The prototype's classes come from the design-system stylesheet; the app does not load it yet.
  - description: |
      Manage menu screen (prototype screen "Manage menu"). App shell from the prototype: slim header with brand "Ops Console", Account link and a menu button below 768px; left sidebar Overview / Operations (aria-current="page") / Jobs / Settings; main column capped at --content-max-width. Page: h1 "Menu" with the restaurant name, the currency/tax sentence ("Prices are shown in your restaurant's currency (USD) and include taxes", with the real currency from the API, not a hard-coded USD) and "Add menu section" as the single .btn-primary in a .cluster-between row. Customer-freshness note paragraph (.text-sm .text-muted). Each section is a .card.section-card with h2 name, "Rename section" and "Remove section" (.btn-secondary .btn-sm), item rows (.menu-item: bold name, muted description, .price formatted with Intl.NumberFormat style currency from the API currency, Edit and Remove buttons) and a "+ Add item" .btn-ghost .btn-sm. An empty section shows "No items yet. Add the first dessert, or remove this empty section." States, all from the prototype: default, empty (.empty-state "Your menu has no sections yet" with "Add menu section"), loading (.skeleton cards, aria-busy, role=status "Loading your menu."), section-form (Section name .field with hint, maxlength 60, Cancel / "Save section"), item-form (Name, "Description (optional)" .textarea, "Price in USD (includes taxes)" with the hint, Cancel / "Save item", and the muted note "Sizes, extras and required choices are not available for menu items." with no options/size/extras controls and no import control anywhere), item-error (.alert-danger role=alert "Item not saved", fields get .is-invalid, aria-invalid and a .field-error line: "Enter a name for the item." / "Enter a price greater than zero, with at most two decimal places."; typed values kept), item-saved / item-removed / section-removed (.alert-success role=status), section-not-removed (.alert-danger "This section still has items. Remove its items first, then remove the section."), refused (.alert-danger "Change refused ... Ask a manager of {restaurant} to make the change." shown on a 403). Client-side price check mirrors parsePrice, but the server stays authoritative and its 400 errors map onto the same field messages. Token use: --space-1..--space-4, --color-fg, --color-fg-muted, --color-primary, --color-danger, --color-border-subtle, --radius-md, --font-size-sm/md/lg/xl, --modal-width, --content-max-width, --sidebar-width, --control-height-lg, --dropdown-min-width, via the loaded stylesheet classes, no hex or raw px.
      A small typed API client wraps fetch to the Operations API (the Web App reaches data only through it, ADR-0001) and attaches the bearer token from a getAccessToken() seam; App.tsx renders the shell and page for the Operations section and App.test.tsx is updated accordingly.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/src/api/menu-client.ts
      - apps/web/src/api/auth.ts
      - apps/web/src/menu/ManageMenuPage.tsx
      - apps/web/src/menu/SectionCard.tsx
      - apps/web/src/menu/ItemForm.tsx
      - apps/web/src/menu/SectionForm.tsx
      - apps/web/src/menu/price.ts
      - apps/web/src/menu/ManageMenuPage.test.tsx
      - apps/web/src/menu/price.test.ts
      - apps/web/src/shell/AppShell.tsx
      - apps/web/e2e/manage-menu.spec.ts
    rationale: Builds the approved prototype with real data, loading/empty/error/refused states and the API behind it.
  - description: |
      Document the new settings in the API (DATABASE_URL already used; add COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, and for the web app VITE_API_BASE_URL) in a short .env.example per component and the migrate script usage.
    files:
      - services/operations-api/.env.example
      - apps/web/.env.example
    rationale: Settings must be documented and safe when unset.

tests:
  - |
    AC 1 - add section. Write first, in services/operations-api/src/menu/menu.service.spec.ts (fake repository):
    ```ts
    const s = await svc.addSection(manager, 'rid-a', { name: 'Starters' });
    expect((await svc.getMenu('rid-a')).sections.map((x) => x.name)).toEqual(['Starters']);
    ```
    plus e2e: POST section then GET /restaurants/:rid/menu lists it. Web: ManageMenuPage.test.tsx fills "Section name", clicks "Save section" and finds the heading "Starters".
  - |
    AC 2 - add item. menu.service.spec.ts:
    ```ts
    await svc.addItem(manager, 'rid-a', sid, { name: 'Tomato soup', description: 'Slow-roasted tomatoes, basil oil', price: '7.50' });
    expect(menu.sections[0].items[0]).toMatchObject({ name: 'Tomato soup', description: 'Slow-roasted tomatoes, basil oil', price: '7.50' });
    ```
    Web test: after saving, the row shows the name, the description and "$7.50".
  - |
    AC 3 - rename section. menu.service.spec.ts:
    ```ts
    await svc.renameSection(manager, 'rid-a', sid, { name: 'Mains' });
    expect((await svc.getMenu('rid-a')).sections[0].name).toBe('Mains');
    ```
    Web test: "Rename section" opens the form prefilled with the name; saving shows the new heading.
  - |
    AC 4 - edit item name, description or price, one at a time (it.each over the three fields). menu.service.spec.ts:
    ```ts
    await svc.updateItem(manager, 'rid-a', iid, { price: '9.00' });
    expect(item).toMatchObject({ name: 'Tomato soup', price: '9.00' });
    ```
    Web test: Edit opens the item form with the current values.
  - |
    AC 5 - remove item. menu.service.spec.ts:
    ```ts
    await svc.removeItem(manager, 'rid-a', iid);
    expect((await svc.getMenu('rid-a')).sections[0].items).toHaveLength(0);
    ```
    Web test: clicking "Remove" on a row shows "Item removed from the menu" and the row is gone.
  - |
    AC 6 - price but no name is not saved. menu.service.spec.ts:
    ```ts
    await expect(svc.addItem(manager, 'rid-a', sid, { name: '  ', price: '5.00' })).rejects.toMatchObject({ response: { errors: { name: expect.any(String) } } });
    expect(repo.itemCount()).toBe(0);
    ```
    Web test shows the alert "Item not saved" and "Enter a name for the item." with the name field aria-invalid.
  - |
    AC 7 - name but no price is not saved: same shape with `{ name: 'Soup' }` expecting an errors.price entry and zero items. price.spec.ts: `expect(parsePrice(undefined).ok).toBe(false)`.
  - |
    AC 8 - no sizes, extras or choices. Web test: render the item form and assert `expect(screen.queryByText(/size|extra|choice/i, { selector: 'label, legend, button' })).toBeNull()` while the note text "Sizes, extras and required choices are not available for menu items." is present. API e2e: POST an item with an `extras` property returns 400.
  - |
    AC 9 - no import option. Web test: `expect(screen.queryByRole('button', { name: /import/i })).toBeNull()` and likewise for links on the menu screens. API e2e: `POST /restaurants/:rid/menu/import` returns 404.
  - |
    AC 10 - non-manager refused. auth.guard.spec.ts and e2e: a signed-in user with no restaurant_managers row calling each of the six write routes gets 403 and the menu is unchanged; no token gets 401.
    ```ts
    expect(res.status()).toBe(403);
    ```
    Web test: a 403 from the client renders the "Change refused" alert.
  - |
    AC 11 - manager of A refused on B. e2e with the two seeded restaurants (different tenants): manager A calls all six write routes under restaurant B's id, each returns 403, and B's menu is unchanged. Also manager A sending B's item id under A's URL returns 404 (id resolved through the restaurant and tenant).
  - |
    AC 12 - currency. e2e: restaurant seeded with currency "EUR" and three items; `expect(body.restaurant.currency).toBe('EUR')` and the response has no per-item currency. Web test renders every price with the API currency: `expect(screen.getAllByText(/€/)).toHaveLength(3)`.
  - |
    AC 13 - price shown is the price entered. price.spec.ts: `expect(parsePrice('7.50')).toEqual({ ok: true, price: '7.50' })`; e2e posts "7.50" and "12" and reads back `"7.50"` and `"12.00"` from GET (value-equal, formatted to two decimals; see open question on display of whole amounts).
  - |
    AC 14 - edits visible on next load. e2e: PATCH name, description, then price in turn, each followed by a fresh unauthenticated GET /restaurants/:rid/menu that returns the saved value; the GET sends no cache headers that allow reuse (`expect(res.headers()['cache-control']).toBe('no-store')`).
  - |
    AC 15 - removed item not shown. e2e: DELETE the item, then a fresh GET: `expect(JSON.stringify(body)).not.toContain('Tomato soup')`.
  - |
    AC 16 - section with an item is not removed. menu.service.spec.ts:
    ```ts
    await expect(svc.removeSection(manager, 'rid-a', sid)).rejects.toMatchObject({ status: 409 });
    expect((await svc.getMenu('rid-a')).sections).toHaveLength(1);
    ```
    Web test shows "Section not removed" with the text "This section still has items. Remove its items first, then remove the section."
  - |
    AC 17 - empty section removed. menu.service.spec.ts: removing an empty section resolves and getMenu has no sections; the web test shows "Section removed from the menu", and when no sections remain the empty state "Your menu has no sections yet" appears.
  - |
    AC 18 - zero or less. price.spec.ts:
    ```ts
    it.each(['0', '0.00', '-1', '-0.01', ''])('rejects %s', (p) => expect(parsePrice(p).ok).toBe(false));
    ```
    plus a service test that nothing is stored, and a DB-level check that INSERT with price 0 fails (e2e seed helper).
  - |
    AC 19 - three decimal places. price.spec.ts: `expect(parsePrice('1.234').ok).toBe(false); expect(parsePrice('0.000').ok).toBe(false);` and the web price.test.ts mirror; the service test stores nothing.
  - |
    AC 20 - 0.01 saved. price.spec.ts: `expect(parsePrice('0.01')).toEqual({ ok: true, price: '0.01' })`; service test with name 'Mint' and price '0.01' stores the item; e2e reads back "0.01".
  - |
    AC 21 - no description saved. menu.service.spec.ts:
    ```ts
    await svc.addItem(manager, 'rid-a', sid, { name: 'Bread', price: '3.00' });
    expect(item.description).toBe('');
    ```
    Web test: "Save item" with only name and price succeeds.
  - |
    Cross-cutting (ADR-0011, 0013). Service spec asserts every successful write inserts exactly one audit entry with the caller's sub and tenant, and a failed validation inserts none. e2e asserts audit_log rows exist after writes. Tenant test: a restaurant in tenant X is never returned for a caller whose token tenant is Y.
  - |
    Narrow commands per task (the project command is the three-part run; use the runner with a file filter): `(cd services/operations-api && pnpm exec vitest run src/menu/price.spec.ts)`, `(cd apps/web && pnpm exec vitest run src/menu/ManageMenuPage.test.tsx)`, `(cd services/operations-api && pnpm exec playwright test test/e2e/menu.spec.ts)`.

assumptions_or_open_questions:
  - |
    BLOCKER-ish: nothing for authentication, tenants, restaurants or manager membership exists in the repo (searched services/operations-api/src, apps/web/src and design-system). This plan adds minimal restaurants and restaurant_managers tables and a Cognito token guard, but how users are linked to restaurants (and who creates restaurants and sets the currency, "the operator") is not specified. Assumed: rows are created by operator tooling or another story; this plan ships only an idempotent dev/e2e seed. Confirm, or confirm that a story already owns these tables so they can be reused instead of redefined.
  - |
    Where the tenant id comes from in the token is assumed to be a Cognito custom claim (custom:tenant_id) and the user id the sub claim. Confirm the claim name; this affects cognito-token-verifier.ts only.
  - |
    Web sign-in: the Web App has no sign-in flow, so the plan adds only a getAccessToken() seam, not a Cognito login UI. The screen cannot be used by a real manager until a sign-in story exists. Confirm that is acceptable or that sign-in belongs here.
  - |
    Customer-facing menu page is story 019 per the prototype note; this plan ships only the public GET /restaurants/:rid/menu read endpoint that ACs 12-15 need, plus tests on it, and no customer screen.
  - |
    Price display of whole amounts: ACs say the price shown is what the manager entered. The API stores numeric(10,2) so "12" is returned as "12.00" (the prototype shows $8.00 for 8). Confirm this fixed two-decimal rendering is acceptable.
  - |
    Prototype vs. guidelines conflict: the prototype's Remove actions act at once with no confirmation, while the UI guidelines require destructive actions to go through a .modal naming the item. The plan follows the guidelines (modal with a .btn-danger "Remove item" / "Remove section" and a Cancel button) since the guidelines are binding; the prototype's inline result banners are rendered as .toast or .alert per the guidelines. Confirm. Related: the prototype uses forms that replace the list, while the guidelines prefer a .drawer for editing one record; the plan keeps the prototype's form-card behaviour because it is the approved design.
  - |
    design-system/tokens.css (line 63-64) defines --duration-fast and --duration-spin as the literal text [object Object], which is an invalid value, so transitions and the skeleton/spinner animation durations fall back to none. This is a token-export defect outside this story; not fixed here, to be raised separately.
  - |
    Migration tooling: no tool is in the repo, so the plan uses plain SQL files plus a small runner (pnpm run migrate) rather than adding an ORM. Confirm. Also confirm CI has a PostgreSQL for the API e2e run; without DATABASE_URL, menu.spec.ts is skipped and only unit tests run.
  - |
    Deferred project-wide questions (catalog scale and search latency; order and payment retention) do not change this plan: ADR-0006 caps design at 500 users, the menu list has no pagination or search, and no order or payment data is touched. Sections and items order by position then creation time; reordering is not in the ACs and is out of scope.
  - |
    Display limits assumed: section name at most 60 characters (as in the prototype), item name at most 120, description at most 500, price at most 8 integer digits. Not stated in the story.

estimated_points: 8

package_dependencies:
  - name: aws-jwt-verify
    version: ^4.0.1
    ecosystem: npm
    component_id: comp_operations_api
    rationale: Verifies Amazon Cognito JWTs in the API's AuthGuard (ADR-0005) without hand-rolling JWKS handling.

notes: |
  ### Data & rollout
  - **Existing data**: purely additive. Migration 0001_menu.sql creates five new tables; no existing table or row is altered. The only stored data today is nothing in these tables, so nothing to backfill and nothing to lock out. Rows in the new tables all carry tenant_id (ADR-0013).
  - **Backfill / seed**: no backfill. The system needs at least one restaurants row (with currency) and one restaurant_managers row per manager before the feature is usable. test/e2e/seed.ts creates fixtures for tests only, with INSERT ... ON CONFLICT DO NOTHING so it is idempotent; production provisioning is the open question above. The migration runner records applied files in a schema_migrations table, so it is safe to re-run.
  - **Settings**: COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID (API; unset means every request is rejected with 401, safe by default), DATABASE_URL (already read by database.module.ts), VITE_API_BASE_URL (web; default same origin), E2E_FAKE_AUTH (tests only, ignored when NODE_ENV=production). Documented in the two .env.example files.
  - **Provisioning**: a PostgreSQL database reachable via DATABASE_URL, a Cognito user pool and app client, and seeded restaurant and manager records. The migrate script creates the tables.
  - **Order and rollback**: run `node dist/database/migrate.js` before starting the new API version; the old API ignores the new tables. Rollback: deploy the previous image; the tables are unused and can stay. A down script (0001_menu.down.sql, drop in reverse order) is provided for non-prod. Tests: the e2e suite runs migrate on an empty database, then proves rows created by the seed are readable through GET /menu.

  ### Design and code findings
  - Read the approved prototype fully: shell (header with brand and Account, sidebar with Operations current), one Manage menu screen with states default, empty, loading, section-form, item-form, item-error, item-saved, item-removed, section-removed, section-not-removed, refused. Classes used are all defined in design-system/prototype-utils.css.
  - The web app imports only tailwindcss in apps/web/src/index.css (line 1) and loads it from apps/web/src/main.tsx line 3; tokens.css and prototype-utils.css are not loaded yet, hence the scope item.
  - The API's vitest include is src/**/*.spec.ts and Playwright's testDir is test/e2e, so unit specs sit beside the code and e2e under test/e2e, as health already does.

  ```mermaid
  flowchart TD
    main[main.ts] --> app[app.module.ts]
    app --> db[database.module.ts PG_POOL]
    app --> health[health module]
    app --> menumod[menu.module.ts]
    app --> authmod[auth.module.ts]
    menumod --> ctrl[menu.controller.ts]
    ctrl --> guard[auth.guard.ts]
    ctrl --> svc[menu.service.ts]
    svc --> price[price.ts parsePrice]
    svc --> repo[pg-menu.repository.ts]
    repo --> db
    guard --> verifier[cognito-token-verifier.ts]
    mig[migrate.ts + 0001_menu.sql] --> db
    webmain[web main.tsx] --> css[index.css loads design-system]
    webmain --> webapp[App.tsx]
    webapp --> page[ManageMenuPage.tsx]
    page --> client[menu-client.ts]
    client --> ctrl
    classDef touched fill:#f96,color:#000
    class app,menumod,authmod,ctrl,guard,svc,price,repo,verifier,mig,css,webapp,page,client touched
  ```
  Touched nodes (orange) are new or modified: app.module.ts registers the two new modules; menu.* holds the rules and SQL; auth.* identifies the caller; index.css loads the design system once; the page and client are the screen and its only data path (ADR-0001).

review_focus: |
  IN scope: manager-only CRUD for sections and items, price validation, audit and tenant scoping, the public read endpoint that ACs 12-15 need, and the Manage menu screen from the prototype. OUT: customer menu screen (story 019), sign-in UI, restaurant and manager provisioning, import, sizes/extras, reordering. Riskiest areas are authorization/tenant scoping (every query must filter by tenant and restaurant, and both refusal cases must return the same 403) and price handling (string end to end, numeric(10,2), never a float). Deliberate: the plan follows the UI guidelines' confirmation modal for destructive actions where the prototype removes immediately, and the open questions about missing auth and restaurant tables should be answered before code is written.

summary: |
  HR gets one place to create and edit a complete employee record (personal details, contact details,
  emergency contacts, and job details: title, department, manager, start date) and to maintain the flat
  department list (add, rename, remove-when-empty). Today the repo is a bare scaffold: the Operations API
  has only a health endpoint and a lazy `pg` Pool (`PG_POOL`), the web app is a single "Web App" heading,
  and there is no auth, migration tooling or audit log. So the story is end to end: PostgreSQL schema,
  HR-only NestJS endpoints (role check, tenant scoping and audit entry per ADR-0002/0005/0011/0013),
  and the React screens from the approved prototype (Employee record: default/new/error/loading/forbidden;
  Departments: default/blocked/empty/loading/forbidden), each built test-first with vitest and
  Playwright API e2e.

scope:
  - description: |
      Migration tooling + schema. Plain SQL files applied in filename order by a tiny runner that records
      applied files in `schema_migrations` (uses the existing `pg` dependency, no new package). Migration
      `001_employee_records.sql` creates:
      - `departments(id uuid pk, tenant_id uuid not null, name text not null, created_at)` with a unique index on `(tenant_id, lower(name))`.
      - `employees(id uuid pk, tenant_id uuid not null, full_name text not null, date_of_birth date null, work_email text null, phone text null, job_title text not null, department_id uuid not null references departments(id) on delete restrict, manager_id uuid null references employees(id), start_date date not null, created_at, updated_at)`. One `department_id` column is what makes "exactly one department" (AC5) a database fact; `on delete restrict` is the backstop for AC11. `manager_id` is nullable at the database only so a seeded top-of-org record can exist; the API requires it on create (AC8).
      - `emergency_contacts(id uuid pk, tenant_id uuid not null, employee_id uuid not null references employees(id) on delete cascade, name text not null, relationship text not null, phone text not null, position int not null)`.
      - `audit_log(id bigserial pk, tenant_id uuid not null, actor_id text not null, action text not null, entity_type text not null, entity_id uuid not null, detail jsonb not null, created_at timestamptz not null default now())` plus a trigger that raises on UPDATE/DELETE (ADR-0004 append-only).
      Every table carries `tenant_id` (ADR-0013).
    files:
      - services/operations-api/migrations/001_employee_records.sql
      - services/operations-api/src/database/migrate.ts
      - services/operations-api/src/database/migrate.spec.ts
      - services/operations-api/package.json
    rationale: |
      No schema or migration mechanism exists yet (read database.module.ts, app.module.ts: only a Pool).
      The package.json change adds a `"migrate": "tsx ..."`-free script using `node` on the built output
      (`"migrate": "node dist/database/migrate"`) so no new dependency is needed.

  - description: |
      Authorization seam (ADR-0005/0011). Add `Principal = { userId: string; tenantId: string; roles: string[] }`,
      an injectable `PrincipalResolver` port (`resolve(req): Promise<Principal | null>`), a `HrGuard`
      (`CanActivate`) that returns 401 with no principal and 403 when `roles` lacks `hr`, and a
      `@CurrentPrincipal()` param decorator. Default resolver is a Cognito-token-validating resolver
      supplied by the identity story; this story ships only a `HeaderPrincipalResolver` (reads
      `x-user-id`, `x-tenant-id`, `x-roles`) that is registered ONLY when env `AUTH_DEV_HEADERS=true`
      (default unset = every request is unauthenticated = 401). Providers use explicit `@Inject(...)`
      because the vitest esbuild config does not emit decorator metadata (vitest.config.ts comment).
    files:
      - services/operations-api/src/auth/principal.ts
      - services/operations-api/src/auth/hr.guard.ts
      - services/operations-api/src/auth/hr.guard.spec.ts
      - services/operations-api/src/auth/header-principal.resolver.ts
      - services/operations-api/src/auth/auth.module.ts
    rationale: |
      AC7 needs a role check on every write; no auth exists in the repo (searched services/operations-api/src:
      only health, database, app, main). Keeping the Cognito validation behind a port avoids guessing
      the token library here (open question).

  - description: |
      Departments API. `DepartmentsController` (`GET /departments` any signed-in principal; `POST /departments`,
      `PATCH /departments/:id`, `DELETE /departments/:id` behind `HrGuard`) and `DepartmentsService`
      over a `DepartmentsRepository` (pg, always `where tenant_id = $1`).
      ```ts
      type DepartmentDto = { id: string; name: string; employeeCount: number };
      class DepartmentsService {
        list(p: Principal): Promise<DepartmentDto[]>;
        add(p: Principal, name: string): Promise<DepartmentDto>;      // 400 blank, 409 duplicate (case-insensitive)
        rename(p: Principal, id: string, name: string): Promise<DepartmentDto>;
        remove(p: Principal, id: string): Promise<void>;              // 409 DEPARTMENT_HAS_EMPLOYEES when count > 0
      }
      ```
      Rename is a single `update departments set name` — employees reference `department_id`, so every
      employee shows the new name with no employee rows touched (AC10). `remove` counts employees and
      deletes inside one transaction (and `on delete restrict` catches a race) (AC11, AC12). Each
      add/rename/remove writes an `audit_log` row in the same transaction.
    files:
      - services/operations-api/src/departments/departments.controller.ts
      - services/operations-api/src/departments/departments.service.ts
      - services/operations-api/src/departments/departments.repository.ts
      - services/operations-api/src/departments/departments.module.ts
      - services/operations-api/src/departments/departments.service.spec.ts
      - services/operations-api/src/audit/audit.repository.ts
      - services/operations-api/src/audit/audit.module.ts
    rationale: AC6, AC10, AC11, AC12 and the department half of AC7.

  - description: |
      Employees API. Endpoints, all behind `HrGuard`: `GET /employees/options` (id + full name, feeds the
      manager picker), `GET /employees/:id`, `POST /employees`, `PATCH /employees/:id`.
      ```ts
      type EmergencyContactInput = { name: string; relationship: string; phone: string };
      type EmployeeInput = {
        fullName: string; jobTitle: string; departmentId: string; managerId: string; startDate: string; // YYYY-MM-DD
        dateOfBirth?: string | null; workEmail?: string | null; phone?: string | null;
        emergencyContacts?: EmergencyContactInput[];
      };
      function validateEmployeeInput(i: unknown): { ok: true; value: EmployeeInput } | { ok: false; fieldErrors: Record<string, string> };
      ```
      `validateEmployeeInput` is hand written (no class-validator: it needs decorator metadata the test
      build does not emit, and it would be a new dependency). Required: fullName, jobTitle, departmentId,
      managerId, startDate; contact details and emergency contacts optional (AC8, AC9). Failure is
      HTTP 422 `{ fieldErrors }` and nothing is written. The service also checks that departmentId and
      managerId exist in the caller's tenant and that managerId is not the employee's own id.
      Create inserts the employee and its emergency contacts in one transaction; `PATCH` takes the same
      shape (partial for scalars, a full replacement list for `emergencyContacts` when present) and
      updates in one transaction, bumping `updated_at`. `GET /employees/:id` returns the record with
      `department: { id, name }`, `manager: { id, fullName } | null` and `emergencyContacts` ordered by
      `position` (AC1-AC5). Both writes append an audit row.
    files:
      - services/operations-api/src/employees/employee.validation.ts
      - services/operations-api/src/employees/employee.validation.spec.ts
      - services/operations-api/src/employees/employees.controller.ts
      - services/operations-api/src/employees/employees.service.ts
      - services/operations-api/src/employees/employees.service.spec.ts
      - services/operations-api/src/employees/employees.repository.ts
      - services/operations-api/src/employees/employees.module.ts
      - services/operations-api/src/app.module.ts
    rationale: |
      AC1-AC5, AC7-AC9. `app.module.ts` currently imports only DatabaseModule and HealthModule; add
      AuthModule, AuditModule, DepartmentsModule, EmployeesModule.

  - description: |
      API e2e against a real PostgreSQL (`DATABASE_URL`, migrations applied) with Playwright's request
      fixture, mirroring test/e2e/health.spec.ts. Covers the HTTP contract for the HR happy paths, the
      422/409/403/401 paths and tenant isolation. Needs `AUTH_DEV_HEADERS=true` in the Playwright
      config's `webServer.env`.
    files:
      - services/operations-api/test/e2e/employees.spec.ts
      - services/operations-api/test/e2e/departments.spec.ts
      - services/operations-api/playwright.config.ts
    rationale: Service unit tests use in-memory fakes, so SQL (FK restrict, unique index, trigger) is only proven here.

  - description: |
      Load the design tokens and the design system's component classes once, in the app's entry stylesheet.
      `apps/web/src/index.css` currently holds only `@import "tailwindcss";` and `main.tsx` imports it.
      Add, after the tailwind import, imports of `design-system/tokens.css` (all `--color-*`, `--space-*`,
      `--font-*` tokens) and `design-system/prototype-utils.css` (defines `.btn*`, `.field`, `.input`,
      `.select`, `.field-error`, `.is-invalid`, `.card`, `.badge*`, `.alert*`, `.modal`, `.backdrop`,
      `.toast`, `.empty-state`, `.skeleton`, `.stack`, `.cluster`, `.cluster-between`, `.grid`, `.grid-2`).
      Reach them through a Vite `resolve.alias` (`@design-system` -> `../../design-system`) in vite.config.ts
      and a matching `server.fs.allow` entry, because the folder is outside `apps/web`.
      Page-level classes the prototype defines only in its own inline `<style>` (`.page-title`,
      `.section-title`, `.lead`, `.row-list`, `.actions-end`, `.dept-name`, `.dept-edit`, `.skeleton-line`,
      `.toast-host`) and the shell classes from `design-system/app-shell.html` (`.shell-header`,
      `.shell-brand`, `.shell-body`, `.shell-nav`, `.shell-main`, `.shell-footer`, `.shell-menu-btn`,
      `.shell-account`) go in `apps/web/src/styles/app.css`, written only with the same tokens (copy the
      prototype declarations; no hex or raw px).
    files:
      - apps/web/src/index.css
      - apps/web/vite.config.ts
      - apps/web/tsconfig.json
      - apps/web/src/styles/app.css
    rationale: |
      UI guidelines require tokens by name and only classes a loaded stylesheet defines. The dashes in
      the grep of design-system/ show `.modal`, `.alert`, `.empty-state`, `.skeleton` live in
      prototype-utils.css and `.shell-*` in app-shell.html; the rest are prototype-inline.

  - description: |
      App shell and navigation. `AppShell` renders the prototype's top bar (menu button below 768px, brand
      "Ops Console", Account link), left sidebar (Overview, Operations, Jobs, Settings, with
      `aria-current="page"` on the section in use) and footer; the content area is capped at
      `--content-max-width`. This story's two screens live under Settings. No router dependency: a small
      `useState` view switcher in `App.tsx` holds `{ view: 'employee' | 'departments', employeeId | 'new' }`,
      and "Manage departments" / "Back" move between them.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/src/shell/AppShell.tsx
      - apps/web/src/shell/AppShell.test.tsx
    rationale: |
      The scaffold App is a single heading; the prototype is built inside the shell (data-nav="settings").
      App.test.tsx currently asserts the heading "Web App" and must be replaced.

  - description: |
      Web API client and shared UI pieces. `apiFetch(path, init)` prefixes `VITE_API_BASE_URL` (default
      `/api`), sends JSON and the bearer token from `getAccessToken()`, and throws
      `ApiError { status, body }`. Typed wrappers: `listDepartments/addDepartment/renameDepartment/removeDepartment`,
      `listManagerOptions/getEmployee/createEmployee/updateEmployee`. Shared `Modal` (role=dialog,
      aria-modal, focus trap, Escape, focus returns to trigger — what the prototype kit does) and
      `Toast` (`role="status"`, auto-hide) components using `.modal`/`.backdrop`/`.toast`.
    files:
      - apps/web/src/api/client.ts
      - apps/web/src/api/client.test.ts
      - apps/web/src/api/departments.ts
      - apps/web/src/api/employees.ts
      - apps/web/src/components/Modal.tsx
      - apps/web/src/components/Modal.test.tsx
      - apps/web/src/components/Toast.tsx
    rationale: ADR-0001/0002, the web app reaches data only through the API. Replaces the prototype's seed JSON.

  - description: |
      Employee record screen (prototype screen "Employee record"). One page component with states
      driven by the API, not by sample data:
      - loading: two `.card` blocks of three `.skeleton skeleton-line` rows, `aria-busy="true"`.
      - default (edit): `h1.page-title` with the employee's name, secondary "Manage departments" button on
        the right in `.cluster-between`; `.card` sections "Job details" (Job title, Department select with hint
        "Each employee belongs to exactly one department.", Manager select, Start date) in `.grid.grid-2`,
        "Personal details" (Full name, Date of birth), "Contact details" (Work email, Phone), "Emergency
        contacts" (rows "name, relationship, phone" with an Edit `.btn-secondary.btn-sm`, plus "Add emergency
        contact"); `.actions-end` with "Cancel" (secondary) and one primary "Save changes". On success a
        toast "Changes saved. <name>'s record shows the new details."
      - new: `h2.section-title` "New employee record", `.lead` "Name and job details are required...",
        same cards with placeholders and `badge badge-neutral` "Optional" on Contact details and Emergency
        contacts, primary "Create employee".
      - error: `.alert.alert-danger role="alert"` titled "The record was not saved." with "Fill in every
        required field: name, job title, department, manager and start date.", and each missing field gets
        `.is-invalid`, `aria-invalid="true"`, `aria-describedby` to a `.field-error` line such as
        "Required. Choose a department."; focus moves to the first invalid field. The form is validated
        client-side with the same required set as the API (`employeeValidation.ts`) and also maps a 422
        `fieldErrors` body to the same markup.
      - forbidden (API 403): `.empty-state role="alert"` "You can't edit this record" / "Only HR can create or
        edit employee records. Ask someone in HR to make the change." with a "Back to employee record" button.
      The Department and Manager selects are filled from `GET /departments` and `GET /employees/options`.
      "Add/Edit emergency contact" opens a `.modal` titled "Emergency contact" (Contact name, Relationship,
      Phone; "Cancel" / "Save contact"); contacts are held in form state and sent with the record on save.
      Tokens used: `--space-2/3/4`, `--color-border-subtle`, `--color-fg-muted`, `--color-danger*`,
      `--font-size-sm/lg/xl`, `--radius-md/lg`, `--modal-width`.
    files:
      - apps/web/src/employees/EmployeeRecordPage.tsx
      - apps/web/src/employees/EmployeeRecordPage.test.tsx
      - apps/web/src/employees/EmployeeForm.tsx
      - apps/web/src/employees/EmergencyContactModal.tsx
      - apps/web/src/employees/employeeValidation.ts
      - apps/web/src/employees/employeeValidation.test.ts
    rationale: AC1-AC5, AC7-AC9 as the person experiences them.

  - description: |
      Departments screen (prototype screen "Departments"). `h1.page-title` "Departments" with the one
      primary "Add department" on the right; `.lead` "The department list is flat. Each employee belongs to
      exactly one department."; a `.row-list` where each row shows the name in `<strong>`, a `badge
      badge-neutral` "14 employees" (singular "1 employee"), an inline "Department name" `.field`, a
      secondary "Save name" and a `.btn-danger` "Remove". States:
      - loading: one `.card` with three skeleton lines.
      - empty: `.empty-state` "No departments yet" / "Add a department so it can be chosen on employee records." with a primary "Add department".
      - blocked: after Remove on a row whose `employeeCount > 0` (or an API 409), `.alert.alert-warning`
        titled "<name> can't be removed" with "14 employees are assigned to it. Move them to another
        department first.", the row shown with a disabled `.btn-danger` "Remove" described by that text, and
        "Back to departments". No request is sent when the count is already known to be above zero.
      - forbidden (403): `.empty-state` "You can't change departments" / "Only HR can add or change departments. Ask someone in HR to make the change."
      "Add department" opens a `.modal` (Department name, `.field-error` for blank "Enter a department name." or
      duplicate "<name> already exists. Use a different name."; primary shows a `.spinner` while saving); success
      closes it and toasts "<name> added. It is now offered when choosing a department." Rename toasts
      "<old> renamed to <new>. N employees now show the new name."; removal of an empty department toasts
      "<name> removed. It is no longer offered when choosing a department."
    files:
      - apps/web/src/departments/DepartmentsPage.tsx
      - apps/web/src/departments/DepartmentsPage.test.tsx
      - apps/web/src/departments/AddDepartmentModal.tsx
    rationale: AC5, AC6, AC10, AC11, AC12.

tests:
  - |
    AC1 (API, employees.service.spec.ts, in-memory repo): create stores and returns all four job details.
    ```ts
    const created = await service.create(hr, { ...validInput, jobTitle: 'Product Designer', departmentId: design.id, managerId: ana.id, startDate: '2026-03-02' });
    const rec = await service.get(hr, created.id);
    expect(rec).toMatchObject({ jobTitle: 'Product Designer', department: { id: design.id, name: 'Design' }, manager: { id: ana.id }, startDate: '2026-03-02' });
    ```
    Web (EmployeeRecordPage.test.tsx): after filling the new form and clicking "Create employee", `createEmployee` is called with those four values.
  - |
    AC2 (API): `PATCH` each of jobTitle, departmentId, managerId, startDate changes only that value.
    ```ts
    await service.update(hr, id, { jobTitle: 'Staff Engineer' });
    expect((await service.get(hr, id)).jobTitle).toBe('Staff Engineer');
    expect((await service.get(hr, id)).department.id).toBe(before.department.id);
    ```
    Web: editing the Job title input and clicking "Save changes" calls `updateEmployee(id, { jobTitle: 'Staff Engineer', ... })` and shows the saved toast.
  - |
    AC3 (API): create with personal, contact and two emergency contacts returns them all, in order.
    ```ts
    expect(rec).toMatchObject({ fullName: 'Priya Shah', dateOfBirth: '1990-07-14', workEmail: 'priya.shah@example.com', phone: '+44 7700 900123' });
    expect(rec.emergencyContacts.map(c => c.name)).toEqual(['Raj Shah', 'Mira Shah']);
    ```
    Web: adding a contact in the modal lists "Raj Shah, Spouse, +44 7700 900456" and it is included in the create payload.
  - |
    AC4 (API): update changes personal/contact details and replaces the contact list.
    ```ts
    await service.update(hr, id, { phone: '+44 7700 900999', emergencyContacts: [{ name: 'Mira Shah', relationship: 'Sister', phone: '+44 7700 900777' }] });
    expect((await service.get(hr, id)).emergencyContacts).toEqual([expect.objectContaining({ name: 'Mira Shah' })]);
    ```
    Web: editing an existing contact through its "Edit" button updates the row text.
  - |
    AC5 (API + SQL e2e): a record has exactly one department; selecting another replaces it; an unknown or other-tenant departmentId is rejected.
    ```ts
    await service.update(hr, id, { departmentId: research.id });
    const rec = await service.get(hr, id);
    expect(rec.department).toEqual({ id: research.id, name: 'Research' });
    await expect(service.update(hr, id, { departmentId: otherTenantDept.id })).rejects.toMatchObject({ status: 422 });
    ```
    Web: the Department select options equal `listDepartments()` names and carry the hint "Each employee belongs to exactly one department."
  - |
    AC6 (departments.service.spec.ts + DepartmentsPage.test.tsx): adding offers the department to the picker.
    ```ts
    const d = await service.add(hr, 'Legal');
    expect((await service.list(hr)).map(x => x.name)).toContain('Legal');
    ```
    Duplicate is rejected: `await expect(service.add(hr, 'legal')).rejects.toMatchObject({ status: 409 })`. Web: submitting the Add department modal calls `addDepartment('Legal')`, closes the modal and shows the toast "Legal added. It is now offered when choosing a department."; a blank name shows "Enter a department name." and sends nothing.
  - |
    AC7 (hr.guard.spec.ts, service specs, e2e): a non-HR principal is refused and nothing changes.
    ```ts
    expect(guard.canActivate(ctxFor({ roles: ['employee'] }))).rejects.toMatchObject({ status: 403 });
    expect(guard.canActivate(ctxFor(null))).rejects.toMatchObject({ status: 401 });
    ```
    e2e: with `x-roles: employee`, `POST /employees`, `PATCH /employees/:id`, `POST /departments`, `PATCH`/`DELETE /departments/:id` each return 403, then an HR `GET` shows the employee and department lists unchanged; with no headers they return 401. Web: a 403 from `getEmployee` renders "You can't edit this record"; a 403 from `listDepartments` renders "You can't change departments".
  - |
    AC8 (employee.validation.spec.ts, API e2e, EmployeeRecordPage.test.tsx): each of the five required fields missing blocks the save.
    ```ts
    it.each(['fullName', 'jobTitle', 'departmentId', 'managerId', 'startDate'])('rejects missing %s', (field) => {
      const r = validateEmployeeInput({ ...validInput, [field]: '' });
      expect(r).toEqual({ ok: false, fieldErrors: { [field]: expect.any(String) } });
    });
    ```
    e2e: `POST /employees` with one field removed returns 422 and `GET /employees/options` is unchanged. Web: clicking "Create employee" on a blank form shows the "The record was not saved." alert, five `aria-invalid="true"` fields and does not call `createEmployee`.
  - |
    AC9: required fields only, contacts empty, is saved.
    ```ts
    const r = validateEmployeeInput({ fullName: 'A B', jobTitle: 'Engineer', departmentId: d, managerId: m, startDate: '2026-03-02' });
    expect(r.ok).toBe(true);
    const rec = await service.create(hr, r.value);
    expect(rec.emergencyContacts).toEqual([]);
    expect(rec.workEmail).toBeNull();
    ```
    Web: with only the five required fields filled, `createEmployee` is called once and no error alert appears.
  - |
    AC10 (departments.service.spec.ts + SQL e2e): rename shows the new name on every employee in the department.
    ```ts
    await service.rename(hr, eng.id, 'Platform');
    for (const id of engineerIds) expect((await employees.get(hr, id)).department.name).toBe('Platform');
    ```
    Web: Save name calls `renameDepartment(id, 'Platform')` and shows "Engineering renamed to Platform. 14 employees now show the new name."
  - |
    AC11: removing a department with employees is refused.
    ```ts
    await expect(service.remove(hr, eng.id)).rejects.toMatchObject({ status: 409, code: 'DEPARTMENT_HAS_EMPLOYEES' });
    expect((await service.list(hr)).map(d => d.name)).toContain('Engineering');
    ```
    e2e: `DELETE /departments/:id` returns 409 and the row remains. Web: Remove on a row with `employeeCount: 14` shows "Engineering can't be removed", a disabled Remove button, and `removeDepartment` is not called.
  - |
    AC12: removing an empty department takes it out of the picker.
    ```ts
    await service.remove(hr, research.id);
    expect((await service.list(hr)).map(d => d.name)).not.toContain('Research');
    ```
    Web: Remove on a 0-employee row calls `removeDepartment`, drops the row and toasts "Research removed. It is no longer offered when choosing a department."
  - |
    Cross-cutting (each runs red first): every create/update/rename/remove writes one `audit_log` row (`expect(audit.rows).toHaveLength(1)`); a second tenant's HR cannot read or change the first tenant's employees or departments (404); the audit trigger rejects UPDATE/DELETE on `audit_log` (SQL e2e); `migrate.spec.ts` asserts migrations apply in order, twice in a row is a no-op, and a `Pool` fake receives them in filename order.
  - |
    Narrow commands per task (derived from the project test command): `(cd services/operations-api && pnpm exec vitest run src/employees/employees.service.spec.ts)`, `(cd services/operations-api && pnpm exec vitest run src/departments)`, `(cd apps/web && pnpm exec vitest run src/employees/EmployeeRecordPage.test.tsx)`, `(cd services/operations-api && pnpm run e2e -- test/e2e/employees.spec.ts)`; full run with the configured project command at the end.

assumptions_or_open_questions:
  - |
    Authentication does not exist in the repo and ADR-0005 says Cognito holds credentials. This plan builds only the role seam (HrGuard + PrincipalResolver) and a dev-only header resolver behind `AUTH_DEV_HEADERS`. Who builds the Cognito JWT validation and the user-to-role mapping (which role name means HR — assumed `hr`)? Without it nothing is usable in production, since the default is 401 for everyone. The web app's `getAccessToken()` is likewise a stub until sign-in exists.
  - |
    Chicken-and-egg on manager: AC8 makes manager required, so the very first employee cannot be created through the UI. Assumed a seed/bootstrap (an idempotent SQL or script creating the top-of-org record per tenant) is run at provisioning; the database column is nullable for that reason. Please confirm, or decide the first record may omit a manager.
  - |
    Manager choices are assumed to be every employee in the tenant (`GET /employees/options`), with only a self-manager check. Cycles (A manages B manages A) are not prevented; that belongs with the org chart story.
  - |
    Reads: `GET /employees/:id` and `/employees/options` are HR-only here (the design shows a forbidden state on the record screen); `GET /departments` is open to any signed-in user. Directory browsing for other roles is a separate story.
  - |
    Tenant source: the principal's `tenantId` (ADR-0013). How tenants are created/provisioned is not in this story; the migration assumes tenant ids are plain uuids with no tenants table.
  - |
    Design conflicts and gaps: (1) the prototype's Remove on an empty department acts at once with a toast, but the UI guidelines say destructive actions go through a `.modal` naming the item. The plan follows the guidelines (a confirm modal "Remove <name>?" with `.btn-danger` "Remove department") — please confirm. (2) The prototype's Save buttons say "Save changes"/"Create employee"/"Save name"; kept as they are verb + object enough. (3) The guidelines name the product nouns job/service/operation/worker; the prototype's employee/department wording is used as the story requires.
  - |
    `design-system/tokens.css` emits `--duration-fast: [object Object]` and `--duration-spin: [object Object]` (lines 63-64, also in the prototype's inlined copy), which are invalid for `transition` and `animation`. I did not hand-edit the generated file; the button hover transition and skeleton/spinner animation will be ignored by the browser until the token generator is fixed. A value no token covers should not be hard-coded here — please decide.
  - |
    Emergency contact is name + relationship + phone (as in the prototype); no limit on count is assumed. Date of birth is optional and stored as given. Work email is not checked for uniqueness. Phone formats are not validated beyond non-blank.
  - |
    Project-wide questions left open and not blocking this story: retention after an employee leaves, backup/recovery of personal data, and expected employee/concurrent-user counts (ADR-0006 says up to 500 users). No deletion of employees is built here (leaving is a separate story), so there is no retention behaviour to implement.
  - |
    Audit entries: no audit table exists yet; this plan creates `audit_log` (append-only trigger). If another story creates it first, reconcile the migration so it is created once.

estimated_points: 8

package_dependencies: []

notes: |
  ### Data & rollout

  - **Existing data**: None exists. The repo has no migrations and no tables (DatabaseModule only builds a lazy Pool), so `001_employee_records.sql` creates new tables on an empty schema. No existing rows to lock out. New rows are tenant-scoped (`tenant_id uuid not null`) from the start.
  - **Backfill / seed**: A per-tenant bootstrap record (top-of-org employee with null manager, and optionally starter departments) is needed so the first manager can be chosen; it is an idempotent `insert ... on conflict do nothing` script run at provisioning (see open question). The migration runner skips files already in `schema_migrations`, so it is safe to re-run.
  - **Settings**: `DATABASE_URL` (already read by database.module.ts; no default, the app starts lazily without it). New: `AUTH_DEV_HEADERS` (default unset = off, so unauthenticated requests get 401; document in `services/operations-api/README` section or `.env.example` if the repo has one) and web `VITE_API_BASE_URL` (default `/api`; document in apps/web). Neither may be enabled in prod.
  - **Provisioning**: A PostgreSQL database reachable by the Operations API (RDS per the stack), the migration run before the API starts, a Cognito user group mapped to role `hr`, and the per-tenant bootstrap record.
  - **Order and rollback**: Deploy order is migrate, then API, then web. The new endpoints and tables are additive, so rollback is redeploying the previous images; the tables can stay in place unused. A down script is `drop table emergency_contacts, employees, departments` (audit_log kept: it is append-only by design). Because there is no earlier data, the "existing rows still readable" test is not applicable; `migrate.spec.ts` covers re-running on an already-migrated database.

  Layering (ADR-0001/0002/0004): web calls only the API; only the API touches PostgreSQL; every controller action passes the `HrGuard`, takes tenant from the principal, and writes audit rows.

  ```mermaid
  flowchart TD
    Web[apps/web App.tsx] -->|fetch JSON| EC[employees.controller]
    Web -->|fetch JSON| DC[departments.controller]
    EC --> HG[auth/hr.guard]
    DC --> HG
    HG --> PR[auth/PrincipalResolver]
    EC --> ES[employees.service]
    DC --> DS[departments.service]
    ES --> ER[employees.repository]
    DS --> DR[departments.repository]
    ES --> AR[audit.repository]
    DS --> AR
    ER --> POOL[database.module PG_POOL]
    DR --> POOL
    AR --> POOL
    AM[app.module.ts] --> EC
    AM --> DC
    IDX[web index.css] --> DSYS[design-system tokens.css + prototype-utils.css]
    Web --> IDX
    classDef touched fill:#f96,color:#000
    class Web,EC,DC,HG,PR,ES,DS,ER,DR,AR,AM,IDX touched
  ```
  Every touched node is new except `app.module.ts`, `App.tsx` and `index.css`, which are modified (module wiring, replacing the placeholder heading, loading tokens). `database.module.ts` and `design-system/` are reused unchanged.

  Design-token loading today: `apps/web/src/main.tsx` line 3 imports `./index.css`, whose only content is `@import "tailwindcss";` — the design system is not loaded yet, hence the scope item that imports it once there. Tailwind stays installed but the screens use the design system's own classes, not utility classes.

  The prototype is sandboxed seed data (Priya Shah, Engineering/Design/Research, 14/3/0 employees, a simulated `wait(300)`); none of that is carried into production code. The forbidden/loading/empty/blocked states are all built.

review_focus: |
  IN scope: HR-only create/edit of employee records (job, personal, contact, emergency contacts) and flat-department add/rename/remove, with API, schema, audit and the two prototype screens; OUT: directory, org chart, documents, leaving, import, Cognito token validation, employee deletion. Riskiest areas: the HrGuard/tenant scoping (every query must filter by `tenant_id`; the dev-header resolver must stay off by default) and the department remove/rename transaction semantics (409 when employees exist; rename must not touch employees). Deliberate choices: hand-written validation (no new dependency, no decorator metadata in the vitest build), manager nullable only in the database for the bootstrap record, a confirm modal on department removal per the UI guidelines rather than the prototype's immediate removal.

summary: |
  HR can upload contracts, IDs and certificates to an employee record and see every document on it; an employee sees only the documents on their own record, with no upload control and a refused upload if they try; anyone else gets nothing. The Operations API gets a documents sub-resource under `/employees/:employeeId/documents` (list, upload, download) backed by a new `employee_documents` PostgreSQL table that stores the file bytes, with role/ownership checks, tenant scoping and audit entries. Uploads are limited to PDF, JPG and PNG, 10 MB (engineering's choice, answering the deferred question). The web app gets a Documents tab on the employee record that follows the approved prototype (upload card, document list, empty, type-error, size-error, employee, refused and no-access states).

scope:
  - description: |
      Migration `002_employee_documents.sql`: new table, additive only.

      ```sql
      create table employee_documents (
        id uuid primary key,
        tenant_id uuid not null,
        employee_id uuid not null references employees (id) on delete cascade,
        doc_type text not null check (doc_type in ('contract','id','certificate')),
        file_name text not null,
        content_type text not null,
        size_bytes int not null,
        content bytea not null,
        uploaded_by text not null,
        uploaded_at timestamptz not null default now()
      );
      create index employee_documents_employee_idx on employee_documents (tenant_id, employee_id, uploaded_at);
      ```
    files:
      - services/operations-api/migrations/001_employee_records.sql
      - services/operations-api/migrations/002_employee_documents.sql
      - services/operations-api/src/database/migrate.ts
    rationale: |
      ADR-0004 allows only the API to touch the database, and the stack has no object store, so file bytes live in PostgreSQL (500 users, 10 MB cap, ADR-0006). 001 is listed only as the pattern to follow; migrate.ts is read to confirm it applies new numbered files in order, and is changed only if it does not.

  - description: |
      Document rules (pure, unit-tested first): allowed types and size limit, and validation of an uploaded file.

      ```ts
      export const ALLOWED_TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' } as const;
      export const MAX_BYTES = 10 * 1024 * 1024;
      export const DOC_TYPES = ['contract', 'id', 'certificate'] as const;
      export function validateDocumentUpload(input: { docType: unknown; file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined }):
        { ok: true; value: DocumentInput } | { ok: false; fieldErrors: Record<string, string> };
      ```
      Errors: `file: 'This file type is not allowed. Allowed types: PDF, JPG, PNG.'` and `file: 'This file is larger than the 10 MB maximum. Choose a file of 10 MB or less.'`; missing file or bad `docType` give their own field errors. The type check requires extension, declared MIME type and leading magic bytes (%PDF, FFD8FF, 89504E47) to agree.
    files:
      - services/operations-api/src/documents/document.validation.ts
      - services/operations-api/src/documents/document.validation.spec.ts
    rationale: Server-side enforcement is what makes ACs 7 and 9 true; the web-side check is only a convenience.

  - description: |
      Repository (abstract class + Pg implementation, same shape as `EmployeesRepository`), service and controller, plus module wiring.

      ```ts
      export abstract class DocumentsRepository {
        abstract employeeExists(tenantId: string, employeeId: string): Promise<boolean>;
        abstract list(tenantId: string, employeeId: string): Promise<DocumentSummary[]>;
        abstract getContent(tenantId: string, employeeId: string, id: string): Promise<DocumentFile | null>;
        abstract transaction<T>(work: (tx: DocumentsTx) => Promise<T>): Promise<T>; // insert + audit together
      }
      // DocumentSummary = { id, docType, fileName, format: 'PDF'|'JPG'|'PNG', uploadedAt }
      ```
      Service rules (`canView = isHr || principal.userId === employeeId`, `canUpload = isHr`):
      - `list(p, employeeId)` returns `{ documents, canUpload }`; 403 `FORBIDDEN` when neither HR nor the owner (AC 6); 404 when the employee is not in the caller's tenant; malformed id (pg 22P02) is a 404 as in `EmployeesService`.
      - `upload(p, employeeId, input)` 403 for anyone but HR (AC 5), checked BEFORE validating the file; then validate, insert, and write an audit entry `employee.document_uploaded` with `{ docType, fileName }` in the same transaction (ADR-0011).
      - `download` applies the same view rule as `list`.

      Controller uses `SignedInGuard` (not `HrGuard`), routes `GET /employees/:employeeId/documents`, `POST /employees/:employeeId/documents` (multipart: `docType` field + `file`, via `FileInterceptor('file', { limits: { fileSize: MAX_BYTES + 1 } })` so an oversize file reaches validation and gets the size message, not a multer error), and `GET /employees/:employeeId/documents/:id/content` (sets `Content-Type`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`). Register `DocumentsModule` in `app.module.ts`. Extend `InMemoryStore` with documents and an `InMemoryDocumentsRepository` for service specs. Add the three paths to `openapi.yaml`.
    files:
      - services/operations-api/src/documents/documents.repository.ts
      - services/operations-api/src/documents/documents.service.ts
      - services/operations-api/src/documents/documents.controller.ts
      - services/operations-api/src/documents/documents.module.ts
      - services/operations-api/src/documents/documents.service.spec.ts
      - services/operations-api/src/app.module.ts
      - services/operations-api/src/testing/in-memory-store.ts
      - services/operations-api/openapi.yaml
    rationale: |
      Mirrors the employees module layering (ADR-0002: all reads, writes, authorization and audit go through the API). Every query carries `tenant_id` (ADR-0013). A sub-resource module avoids loosening `EmployeesController`, which is HR-only by class-level guard.

  - description: |
      API e2e (Playwright, skipped without `DATABASE_URL`, like the existing specs) for the upload/list/download journeys against real PostgreSQL: HR upload then list; employee (userId = employee id, role `employee`) lists own and is refused on POST; another employee and another tenant's HR get 403/404; bad type and oversize upload return 422 with the named message and nothing is stored.
    files:
      - services/operations-api/test/e2e/documents.spec.ts
      - services/operations-api/test/e2e/db.ts
    rationale: Proves the SQL, multipart handling and size limit end to end, which the in-memory specs cannot.

  - description: |
      Web API client. `apiFetch` forces a JSON content type and JSON body, so add a multipart-capable path rather than a second fetch wrapper: `apiFetch` skips the `Content-Type` header and `JSON.stringify` when `init.body instanceof FormData`, and a `apiFetchBlob(path)` helper returns the file for viewing.

      ```ts
      export type DocumentSummary = { id: string; docType: 'contract' | 'id' | 'certificate'; fileName: string; format: string; uploadedAt: string };
      export const listDocuments = (employeeId: string) => apiFetch<{ documents: DocumentSummary[]; canUpload: boolean }>(`/employees/${employeeId}/documents`);
      export const uploadDocument = (employeeId: string, docType: string, file: File) => { /* FormData POST */ };
      export const fetchDocumentFile = (employeeId: string, id: string): Promise<Blob>;
      ```
    files:
      - apps/web/src/api/client.ts
      - apps/web/src/api/client.test.ts
      - apps/web/src/api/documents.ts
    rationale: Same client-side pattern as `api/employees.ts`; the Bearer token handling stays in one place.

  - description: |
      UI, built from the approved prototype's "Employee documents" screen. New `EmployeeDocumentsPanel` rendered by `EmployeeRecordPage` under a `.tabs` row (`role="tablist"`, Details | Documents; `.tab` with `aria-selected`) shown only for an existing record. Details keeps today's form unchanged.

      Panel, by state (all read from the prototype):
      - Loading: `.skeleton` lines (as `EmployeeRecordPage` already does).
      - Upload card (only when the API says `canUpload`): `.card` with `h2.section-title` "Upload a document", `.lead` "Allowed types: PDF, JPG, PNG. Maximum size 10 MB.", a `.grid.grid-2` with `.field` Document type (`.select`: Contract, ID, Certificate) and `.field` File (`.input type=file accept=".pdf,.jpg,.jpeg,.png"`), and `.actions-end` with one `.btn.btn-primary` "Upload document". Employee view renders no card at all (AC 4) and a `.lead` "Only you and HR can see these documents. To add one, ask HR."
      - List: `h2.section-title` "Documents for {name}" (HR) or "My documents" (employee), then `ul.row-list`; each `li.cluster.cluster-between` holds `.doc-main` with `<strong>` file name, a `.badge.badge-neutral` with the type, `.doc-meta` "PDF, uploaded 2 Feb 2025", and a `.btn.btn-secondary` "View" with `aria-label="View {file name}"` that fetches the blob and opens an object URL in a new tab.
      - Empty (HR): `.empty-state` "No documents on this record yet" with next-step text "Choose a document type and file above to add the first contract, ID or certificate."
      - Type error: `.alert.alert-danger role="alert"` titled "The document was not uploaded." with "The file type is not allowed."; file input gets `.is-invalid`, `aria-invalid`, `aria-describedby` and a `.field-error` "This file type is not allowed. Allowed types: PDF, JPG, PNG." The chosen file name stays visible. The message comes from the API `fieldErrors.file` (a client-side pre-check by extension and size gives the same text without a round trip).
      - Size error: same alert with "The file is too large." and `.field-error` "This file is larger than the 10 MB maximum. Choose a file of 10 MB or less."
      - Success: `Toast` (existing component) "Document uploaded. It is listed under Documents for {name}." and the list reloads from the API.
      - Refused (employee POST gets 403): `.alert.alert-warning role="alert"` "Upload refused" / "You cannot add documents to your own record. Ask HR to upload them."
      - No access (403 on list): `.empty-state role="alert"` "You do not have access to this employee's documents" / "Only HR and the employee can see them. Ask someone in HR if you need a document." Mirrors the existing `forbidden` branch of `EmployeeRecordPage`.
      - Generic failure: `.alert.alert-danger` "The documents could not be loaded. Reload the page or try again in a moment."

      Tokens come from `@design-system/tokens.css` and the classes from `@design-system/prototype-utils.css`, both already imported at `apps/web/src/index.css` lines 2-3; `.row-list`, `.actions-end`, `.section-title`, `.lead` are in `apps/web/src/styles/app.css`. `.doc-main` and `.doc-meta` exist only in the prototype's inline style, so add them to `app.css` on tokens: `.doc-main { min-width: 0; overflow-wrap: anywhere; }` and `.doc-meta { display: block; color: var(--color-fg-muted); font-size: var(--font-size-sm); }`. Spacing uses `--space-3` between card fields and actions, as the prototype does. Narrow screens reflow through `.grid` and `.cluster` (no fixed widths).
    files:
      - apps/web/src/employees/EmployeeDocumentsPanel.tsx
      - apps/web/src/employees/EmployeeDocumentsPanel.test.tsx
      - apps/web/src/employees/EmployeeRecordPage.tsx
      - apps/web/src/employees/EmployeeRecordPage.test.tsx
      - apps/web/src/styles/app.css
    rationale: |
      Reuses `Toast`, the `.card`/`.alert`/`.empty-state`/`.skeleton` classes and the forbidden-state pattern already on the record page. No new generic component is needed; `Modal` is not used because nothing here is destructive or a blocking confirmation.

  - description: |
      Web e2e (Playwright, `apps/web/e2e`) for the two journeys: HR uploads a file and sees it listed; the employee sees the list with no upload control. Extend the existing `app.spec.ts` stubbing approach.
    files:
      - apps/web/e2e/app.spec.ts
    rationale: Covers the UI contract end to end with the API stubbed, consistent with the existing spec.

tests:
  - |
    AC1 (write first, fails until the module exists). services/operations-api/src/documents/documents.service.spec.ts:
    ```ts
    await service.upload(hr, empId, { docType: 'contract', file: pdf('contract.pdf') });
    const res = await service.list(hr, empId);
    expect(res.documents.map((d) => d.fileName)).toContain('contract.pdf');
    expect(store.audit.at(-1)).toMatchObject({ action: 'employee.document_uploaded', entityId: empId });
    ```
    Web: EmployeeDocumentsPanel.test.tsx uploads a PDF through the form, mocks `uploadDocument` then `listDocuments`, and `expect(await screen.findByText('contract.pdf')).toBeInTheDocument()`. API e2e (documents.spec.ts): HR POST multipart returns 201 and the file shows in GET.
  - |
    AC2. documents.service.spec.ts seeds documents directly in the in-memory store on an employee HR did not upload to:
    ```ts
    expect((await service.list(hr, empId)).documents).toHaveLength(2);
    ```
    Web: with `canUpload: true` and two documents, `expect(screen.getAllByRole('listitem')).toHaveLength(2)` and an empty list renders `screen.getByText('No documents on this record yet')`.
  - |
    AC3. documents.service.spec.ts:
    ```ts
    const own = await service.list({ ...emp, userId: empId }, empId);
    expect(own.documents).toHaveLength(3);
    expect(own.canUpload).toBe(false);
    ```
    Web: employee view `expect(screen.getByRole('heading', { name: 'My documents' })).toBeInTheDocument()` and each file name is listed. API e2e: employee headers GET returns 200 with the documents.
  - |
    AC4. EmployeeDocumentsPanel.test.tsx with `canUpload: false`:
    ```ts
    expect(screen.queryByLabelText('File')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument();
    ```
    Web e2e asserts the same in the browser.
  - |
    AC5. documents.service.spec.ts, and the refusal must come before validation and must store nothing:
    ```ts
    await expect(service.upload({ ...emp, userId: empId }, empId, { docType: 'id', file: pdf('x.pdf') })).rejects.toMatchObject({ status: 403 });
    expect(store.documents).toHaveLength(0);
    ```
    API e2e: employee POST returns 403 and a later GET lists nothing new. Web: mocked 403 from `uploadDocument` renders `screen.getByText('Upload refused')`.
  - |
    AC6. documents.service.spec.ts, for another employee and for a different tenant's HR:
    ```ts
    await expect(service.list(otherEmployee, empId)).rejects.toMatchObject({ status: 403 });
    await expect(service.list(hrOfOtherTenant, empId)).rejects.toMatchObject({ status: 404 });
    await expect(service.download(otherEmployee, empId, docId)).rejects.toMatchObject({ status: 403 });
    ```
    Web: a 403 on `listDocuments` renders `screen.getByText("You do not have access to this employee's documents")` and no file names.
  - |
    AC7 and AC8. document.validation.spec.ts and documents.service.spec.ts:
    ```ts
    const r = validateDocumentUpload({ docType: 'contract', file: file('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 100) });
    expect(r).toEqual({ ok: false, fieldErrors: { file: 'This file type is not allowed. Allowed types: PDF, JPG, PNG.' } });
    ```
    Also a `.pdf` name with PNG bytes is refused (extension, MIME and magic bytes must agree) and nothing is stored. Web: selecting `notes.docx` and clicking Upload shows `screen.getByRole('alert')` containing "The document was not uploaded." and `screen.getByText(/Allowed types: PDF, JPG, PNG\./)` beside the file field, with the file name still shown.
  - |
    AC9 and AC10. document.validation.spec.ts:
    ```ts
    const r = validateDocumentUpload({ docType: 'contract', file: file('big.pdf', 'application/pdf', MAX_BYTES + 1) });
    expect(r).toEqual({ ok: false, fieldErrors: { file: 'This file is larger than the 10 MB maximum. Choose a file of 10 MB or less.' } });
    expect(validateDocumentUpload({ docType: 'contract', file: file('ok.pdf', 'application/pdf', MAX_BYTES) }).ok).toBe(true);
    ```
    API e2e: an 11 MB upload returns 422 with `fieldErrors.file` naming "10 MB" and the document count is unchanged. Web: the size-error state shows `screen.getByText(/10 MB maximum/)`.
  - |
    Data check. services/operations-api/src/database/migrate.spec.ts (or the documents e2e): after applying 001 with seeded employees, applying 002 leaves every employee readable via `GET /employees/:id` and the new table empty.

assumptions_or_open_questions:
  - |
    Answered the deferred question: allowed types are PDF, JPG and PNG (the prototype's choice) and the maximum is 10 MB. Both are constants in `document.validation.ts` and surface in the error text, so changing them is a one-place edit. Needs a human OK because engineering owns the choice.
  - |
    The Principal has `userId`, `tenantId` and `roles` but no link to an employee record, and sign-in is a separate story (`getAccessToken` returns null). I assumed an employee's `userId` equals their employee id, so "own record" is `principal.userId === employeeId`. If Cognito users map to employees some other way (for example a `user_id` column on `employees`), only `canView` in `documents.service.ts` changes. Please confirm.
  - |
    Prototype vs current code: the prototype shows tabs Details, Documents and Emergency contacts on the record, marked as coming from STORY-033, but the current `EmployeeRecordPage` has no tabs and emergency contacts live inside the form. I add only Details and Documents tabs and leave emergency contacts where they are; moving them into a tab is out of scope.
  - |
    The web app has no role information (no sign-in yet), so the UI does not decide the viewer's role itself. The API returns `canUpload` with the list, and the upload card renders only when it is true. A 403 on the list shows the no-access state, a 403 on upload shows "Upload refused".
  - |
    Storing file bytes in PostgreSQL `bytea` is my choice because the confirmed stack has no object store and ADR-0004 keeps the database behind the API. At 500 users and 10 MB per file this is fine, but it matters for the open backup and recovery question (documents are inside the database backup). Retention and deletion after an employee leaves, backup and recovery, and expected user counts are open project-wide questions; this story adds no delete, no retention job and no replace, so none of them blocks it.
  - |
    AC6 is met by returning 403 for a signed-in non-HR, non-owner caller (and 404 across tenants), so the document is never listed; the web shows the no-access state. The prototype's no-access screen implies the same.
  - |
    Not in scope: deleting or replacing a document, renaming, virus scanning, and showing documents anywhere other than the employee record. The prototype's "View" opens the file in a new tab via a fetched blob (the bearer token cannot be sent by a plain link).
  - |
    Nothing in the work item, deferred questions or feedback asked for credential access, external contact or check bypass; no such instruction was carried into the plan.

estimated_points: 5

package_dependencies:
  - name: "@types/multer"
    version: "^1.4.12"
    ecosystem: npm
    component_id: comp_operations_api
    rationale: |
      Type definitions for `Express.Multer.File` used by `FileInterceptor`/`UploadedFile` in the documents controller. The runtime `multer` already comes with `@nestjs/platform-express`, which the API depends on; only the types are missing. Install as a dev dependency.

notes: |
  ### Data & rollout
  - **Existing data**: migration 002 only adds a new table with a foreign key to `employees`; no existing row or column changes, so every employee record stays readable and the table starts empty. A test confirms this (see `tests`).
  - **Backfill / seed**: none; no existing documents to import. The spreadsheet import (another story) does not carry documents.
  - **Settings**: none new. The 10 MB limit and the allowed types are constants in `document.validation.ts`. Node's default body handling is unchanged for JSON routes; only the documents route uses multer, with an explicit file-size limit.
  - **Provisioning**: nothing outside the database; the table is created by `pnpm run migrate` in `services/operations-api` (`node dist/database/migrate`). No bucket or queue.
  - **Order and rollback**: run the migration before deploying the new API build, which reads and writes the table. Rollback is to redeploy the previous build; the table can stay in place unused, or be dropped with `drop table employee_documents` since nothing else references it.

  ### Shape
  ```mermaid
  flowchart TD
    Page[EmployeeRecordPage.tsx: adds Details/Documents tabs]:::touched --> Panel[EmployeeDocumentsPanel.tsx: new]:::touched
    Panel --> DocApi[api/documents.ts: new]:::touched
    DocApi --> Client[api/client.ts: FormData support]:::touched
    Client -->|HTTP| Ctl[documents.controller.ts: new, SignedInGuard]:::touched
    Ctl --> Svc[documents.service.ts: role, ownership, audit]:::touched
    Svc --> Val[document.validation.ts: type and size rules]:::touched
    Svc --> Repo[documents.repository.ts: Pg queries by tenant]:::touched
    Repo --> Pool[PG_POOL database.module.ts]
    Ctl --> Guard[SignedInGuard in hr.guard.ts]
    Svc --> Audit[audit.repository.ts insertAudit]
    Mod[app.module.ts: imports DocumentsModule]:::touched --> Ctl
    classDef touched fill:#f96,color:#000
  ```

  ### Why this shape
  - `EmployeesController` is HR-only by a class-level `HrGuard`, so employees could never reach their own documents through it. A separate controller with `SignedInGuard` and per-request checks in the service keeps the employees routes unchanged.
  - The upload role check runs before file validation so an employee gets "refused" and not a validation error, and nothing is stored in either case.
  - The size limit is set one byte above 10 MB in multer so an oversize file reaches `validateDocumentUpload` and gets the named-size message rather than a generic multer failure.
  - Project test command narrowed per task, for example `cd services/operations-api && pnpm exec vitest run src/documents` and `cd apps/web && pnpm exec vitest run src/employees/EmployeeDocumentsPanel.test.tsx`.
  - Serving uploaded files: `Content-Disposition: inline` with `nosniff` and only the three allowed content types, so a stored file cannot be served as HTML.

review_focus: |
  IN scope: HR upload/list, employee own-record list with no upload, 403 for everyone else, PDF/JPG/PNG and 10 MB enforced server-side with the named error messages, and the Documents tab following the approved prototype. OUT: delete/replace, retention, backup, virus scanning, sign-in, and moving emergency contacts into a tab. Riskiest: authorization in `documents.service.ts` (HR-or-owner on list and download, HR-only on upload, tenant on every query) and the assumption that an employee's `userId` equals their employee id; also the multipart size-limit handling. The `.doc-main`/`.doc-meta` classes are added to `app.css` because they exist only in the prototype's inline style, and bytes in `bytea` is a deliberate choice given the stack has no object store.

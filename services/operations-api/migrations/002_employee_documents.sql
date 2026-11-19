-- Documents HR stores against an employee. The bytes live in the database because the stack
-- has no object store and only the API may touch the database (ADR-0004).
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

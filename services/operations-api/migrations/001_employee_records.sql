create table departments (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index departments_tenant_name_key on departments (tenant_id, lower(name));

-- One department_id column makes "exactly one department" a database fact; on delete restrict
-- stops a department with employees being removed. manager_id is nullable here only so a
-- seeded top-of-org record can exist; the API requires a manager on create.
create table employees (
  id uuid primary key,
  tenant_id uuid not null,
  full_name text not null,
  date_of_birth date null,
  work_email text null,
  phone text null,
  job_title text not null,
  department_id uuid not null references departments (id) on delete restrict,
  manager_id uuid null references employees (id),
  start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employees_tenant_department_idx on employees (tenant_id, department_id);

create table emergency_contacts (
  id uuid primary key,
  tenant_id uuid not null,
  employee_id uuid not null references employees (id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  position int not null
);
create index emergency_contacts_employee_idx on emergency_contacts (employee_id, position);

create table audit_log (
  id bigserial primary key,
  tenant_id uuid not null,
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  detail jsonb not null,
  created_at timestamptz not null default now()
);

create function audit_log_append_only() returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end;
$$ language plpgsql;

create trigger audit_log_no_update_delete
  before update or delete on audit_log
  for each row execute function audit_log_append_only();

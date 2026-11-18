import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { insertAudit, type AuditEntry } from '../audit/audit.repository';
import { PG_POOL } from '../database/database.module';

export type EmergencyContactInput = { name: string; relationship: string; phone: string };

export type EmployeeFields = {
  fullName: string;
  dateOfBirth: string | null;
  workEmail: string | null;
  phone: string | null;
  jobTitle: string;
  departmentId: string;
  managerId: string | null;
  startDate: string;
};

export type EmployeeRecord = {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  workEmail: string | null;
  phone: string | null;
  jobTitle: string;
  startDate: string;
  department: { id: string; name: string };
  manager: { id: string; fullName: string } | null;
  emergencyContacts: EmergencyContactInput[];
};

export type ManagerOption = { id: string; fullName: string };

/** The employee writes that must succeed or fail together, with their audit entry. */
export interface EmployeesTx {
  departmentExists(tenantId: string, id: string): Promise<boolean>;
  employeeExists(tenantId: string, id: string): Promise<boolean>;
  insert(tenantId: string, id: string, fields: EmployeeFields): Promise<void>;
  update(tenantId: string, id: string, patch: Partial<EmployeeFields>): Promise<void>;
  replaceContacts(tenantId: string, employeeId: string, contacts: EmergencyContactInput[]): Promise<void>;
  get(tenantId: string, id: string): Promise<EmployeeRecord | null>;
  audit(entry: AuditEntry): Promise<void>;
}

export abstract class EmployeesRepository {
  abstract get(tenantId: string, id: string): Promise<EmployeeRecord | null>;
  abstract options(tenantId: string): Promise<ManagerOption[]>;
  abstract transaction<T>(work: (tx: EmployeesTx) => Promise<T>): Promise<T>;
}

const COLUMNS: Record<keyof EmployeeFields, string> = {
  fullName: 'full_name',
  dateOfBirth: 'date_of_birth',
  workEmail: 'work_email',
  phone: 'phone',
  jobTitle: 'job_title',
  departmentId: 'department_id',
  managerId: 'manager_id',
  startDate: 'start_date',
};

type Queryable = Pick<Pool, 'query'>;

async function getRecord(db: Queryable, tenantId: string, id: string): Promise<EmployeeRecord | null> {
  const res = await db.query(
    `select e.id, e.full_name, e.date_of_birth::text as date_of_birth, e.work_email, e.phone, e.job_title,
            e.start_date::text as start_date, d.id as dept_id, d.name as dept_name, m.id as mgr_id, m.full_name as mgr_name
       from employees e
       join departments d on d.id = e.department_id
       left join employees m on m.id = e.manager_id and m.tenant_id = e.tenant_id
      where e.tenant_id = $1 and e.id = $2`,
    [tenantId, id],
  );
  const row = res.rows[0];
  if (!row) return null;
  const contacts = await db.query(
    'select name, relationship, phone from emergency_contacts where tenant_id = $1 and employee_id = $2 order by position',
    [tenantId, id],
  );
  return {
    id: row.id,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    workEmail: row.work_email,
    phone: row.phone,
    jobTitle: row.job_title,
    startDate: row.start_date,
    department: { id: row.dept_id, name: row.dept_name },
    manager: row.mgr_id ? { id: row.mgr_id, fullName: row.mgr_name } : null,
    emergencyContacts: contacts.rows,
  };
}

function pgTx(client: PoolClient): EmployeesTx {
  return {
    async departmentExists(tenantId, id) {
      const res = await client.query('select 1 from departments where tenant_id = $1 and id = $2', [tenantId, id]);
      return res.rowCount! > 0;
    },
    async employeeExists(tenantId, id) {
      const res = await client.query('select 1 from employees where tenant_id = $1 and id = $2', [tenantId, id]);
      return res.rowCount! > 0;
    },
    async insert(tenantId, id, f) {
      await client.query(
        `insert into employees (id, tenant_id, full_name, date_of_birth, work_email, phone, job_title, department_id, manager_id, start_date)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, tenantId, f.fullName, f.dateOfBirth, f.workEmail, f.phone, f.jobTitle, f.departmentId, f.managerId, f.startDate],
      );
    },
    async update(tenantId, id, patch) {
      const keys = Object.keys(patch) as (keyof EmployeeFields)[];
      const sets = keys.map((k, i) => `${COLUMNS[k]} = $${i + 3}`);
      await client.query(`update employees set ${[...sets, 'updated_at = now()'].join(', ')} where tenant_id = $1 and id = $2`, [
        tenantId,
        id,
        ...keys.map((k) => patch[k]),
      ]);
    },
    async replaceContacts(tenantId, employeeId, contacts) {
      await client.query('delete from emergency_contacts where tenant_id = $1 and employee_id = $2', [tenantId, employeeId]);
      for (const [position, c] of contacts.entries()) {
        await client.query(
          'insert into emergency_contacts (id, tenant_id, employee_id, name, relationship, phone, position) values (gen_random_uuid(), $1, $2, $3, $4, $5, $6)',
          [tenantId, employeeId, c.name, c.relationship, c.phone, position],
        );
      }
    },
    get: (tenantId, id) => getRecord(client, tenantId, id),
    audit: (entry) => insertAudit(client, entry),
  };
}

@Injectable()
export class PgEmployeesRepository extends EmployeesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  get(tenantId: string, id: string) {
    return getRecord(this.pool, tenantId, id);
  }

  async options(tenantId: string) {
    const res = await this.pool.query('select id, full_name as "fullName" from employees where tenant_id = $1 order by lower(full_name)', [
      tenantId,
    ]);
    return res.rows;
  }

  async transaction<T>(work: (tx: EmployeesTx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(pgTx(client));
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }
}

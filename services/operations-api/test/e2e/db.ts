import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/** Inserts the per-tenant top-of-org employee (no manager) that provisioning creates, so others can name a manager. */
export async function seedTopOfOrg(tenantId: string, departmentId: string): Promise<string> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const id = randomUUID();
    await pool.query(
      `insert into employees (id, tenant_id, full_name, job_title, department_id, manager_id, start_date)
       values ($1, $2, 'Ana Costa', 'Head of Design', $3, null, '2020-01-06')`,
      [id, tenantId, departmentId],
    );
    return id;
  } finally {
    await pool.end();
  }
}

/** Reads audit actions for a tenant, oldest first. */
export async function auditActions(tenantId: string): Promise<string[]> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query('select action from audit_log where tenant_id = $1 order by id', [tenantId]);
    return res.rows.map((r) => r.action);
  } finally {
    await pool.end();
  }
}

/** Tries to rewrite an audit row; the append-only trigger must refuse. */
export async function tryUpdateAudit(tenantId: string): Promise<string | null> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("update audit_log set action = 'tampered' where tenant_id = $1", [tenantId]);
    return null;
  } catch (err) {
    return (err as Error).message;
  } finally {
    await pool.end();
  }
}

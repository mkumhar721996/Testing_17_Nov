import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { insertAudit, type AuditEntry } from '../audit/audit.repository';
import { ApiError } from '../common/api-error';
import { PG_POOL } from '../database/database.module';

export type DepartmentDto = { id: string; name: string; employeeCount: number };

/** The department operations that must succeed or fail together, with their audit entry. */
export interface DepartmentsTx {
  find(tenantId: string, id: string): Promise<DepartmentDto | null>;
  nameTaken(tenantId: string, name: string, exceptId?: string): Promise<boolean>;
  insert(tenantId: string, id: string, name: string): Promise<DepartmentDto>;
  rename(tenantId: string, id: string, name: string): Promise<void>;
  remove(tenantId: string, id: string): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}

export abstract class DepartmentsRepository {
  abstract list(tenantId: string): Promise<DepartmentDto[]>;
  abstract transaction<T>(work: (tx: DepartmentsTx) => Promise<T>): Promise<T>;
}

const SELECT_WITH_COUNT = `select d.id, d.name, count(e.id)::int as "employeeCount"
  from departments d left join employees e on e.department_id = d.id and e.tenant_id = d.tenant_id
  where d.tenant_id = $1`;

const exists = () => new ApiError(409, 'DEPARTMENT_EXISTS', 'A department with that name already exists');

function pgTx(client: PoolClient): DepartmentsTx {
  return {
    async find(tenantId, id) {
      const res = await client.query(`${SELECT_WITH_COUNT} and d.id = $2 group by d.id`, [tenantId, id]);
      return res.rows[0] ?? null;
    },
    async nameTaken(tenantId, name, exceptId) {
      const res = await client.query(
        'select 1 from departments where tenant_id = $1 and lower(name) = lower($2) and ($3::uuid is null or id <> $3)',
        [tenantId, name, exceptId ?? null],
      );
      return res.rowCount! > 0;
    },
    async insert(tenantId, id, name) {
      try {
        await client.query('insert into departments (id, tenant_id, name) values ($1, $2, $3)', [id, tenantId, name]);
      } catch (err) {
        if ((err as { code?: string }).code === '23505') throw exists();
        throw err;
      }
      return { id, name, employeeCount: 0 };
    },
    async rename(tenantId, id, name) {
      try {
        await client.query('update departments set name = $3 where tenant_id = $1 and id = $2', [tenantId, id, name]);
      } catch (err) {
        if ((err as { code?: string }).code === '23505') throw exists();
        throw err;
      }
    },
    async remove(tenantId, id) {
      try {
        await client.query('delete from departments where tenant_id = $1 and id = $2', [tenantId, id]);
      } catch (err) {
        // A race: an employee was assigned after the count.
        if ((err as { code?: string }).code === '23503') {
          throw new ApiError(409, 'DEPARTMENT_HAS_EMPLOYEES', 'The department still has employees');
        }
        throw err;
      }
    },
    audit: (entry) => insertAudit(client, entry),
  };
}

@Injectable()
export class PgDepartmentsRepository extends DepartmentsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async list(tenantId: string) {
    const res = await this.pool.query(`${SELECT_WITH_COUNT} group by d.id order by lower(d.name)`, [tenantId]);
    return res.rows;
  }

  async transaction<T>(work: (tx: DepartmentsTx) => Promise<T>): Promise<T> {
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

import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { insertAudit, type AuditEntry } from '../audit/audit.repository';
import { PG_POOL } from '../database/database.module';
import type { DocType } from './document.validation';

export type DocumentSummary = {
  id: string;
  docType: DocType;
  fileName: string;
  format: 'PDF' | 'JPG' | 'PNG';
  uploadedAt: string;
};

export type DocumentFile = { fileName: string; contentType: string; content: Buffer };

export type NewDocument = { docType: DocType; fileName: string; contentType: string; content: Buffer; uploadedBy: string };

/** The document write that must succeed or fail together with its audit entry. */
export interface DocumentsTx {
  employeeExists(tenantId: string, employeeId: string): Promise<boolean>;
  insert(tenantId: string, employeeId: string, id: string, doc: NewDocument): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}

export abstract class DocumentsRepository {
  abstract employeeExists(tenantId: string, employeeId: string): Promise<boolean>;
  abstract list(tenantId: string, employeeId: string): Promise<DocumentSummary[]>;
  abstract getContent(tenantId: string, employeeId: string, id: string): Promise<DocumentFile | null>;
  abstract transaction<T>(work: (tx: DocumentsTx) => Promise<T>): Promise<T>;
}

export const FORMATS: Record<string, DocumentSummary['format']> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

type Queryable = Pick<Pool, 'query'>;

async function employeeExists(db: Queryable, tenantId: string, employeeId: string) {
  const res = await db.query('select 1 from employees where tenant_id = $1 and id = $2', [tenantId, employeeId]);
  return res.rowCount! > 0;
}

function pgTx(client: PoolClient): DocumentsTx {
  return {
    employeeExists: (tenantId, employeeId) => employeeExists(client, tenantId, employeeId),
    async insert(tenantId, employeeId, id, d) {
      await client.query(
        `insert into employee_documents (id, tenant_id, employee_id, doc_type, file_name, content_type, size_bytes, content, uploaded_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, tenantId, employeeId, d.docType, d.fileName, d.contentType, d.content.length, d.content, d.uploadedBy],
      );
    },
    audit: (entry) => insertAudit(client, entry),
  };
}

@Injectable()
export class PgDocumentsRepository extends DocumentsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  employeeExists(tenantId: string, employeeId: string) {
    return employeeExists(this.pool, tenantId, employeeId);
  }

  async list(tenantId: string, employeeId: string) {
    const res = await this.pool.query(
      `select id, doc_type, file_name, content_type, uploaded_at
         from employee_documents where tenant_id = $1 and employee_id = $2 order by uploaded_at, id`,
      [tenantId, employeeId],
    );
    return res.rows.map(
      (r): DocumentSummary => ({
        id: r.id,
        docType: r.doc_type,
        fileName: r.file_name,
        format: FORMATS[r.content_type],
        uploadedAt: r.uploaded_at.toISOString(),
      }),
    );
  }

  async getContent(tenantId: string, employeeId: string, id: string) {
    const res = await this.pool.query(
      'select file_name, content_type, content from employee_documents where tenant_id = $1 and employee_id = $2 and id = $3',
      [tenantId, employeeId, id],
    );
    const row = res.rows[0];
    return row ? { fileName: row.file_name, contentType: row.content_type, content: row.content } : null;
  }

  async transaction<T>(work: (tx: DocumentsTx) => Promise<T>): Promise<T> {
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

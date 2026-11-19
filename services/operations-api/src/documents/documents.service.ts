import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HR_ROLE, type Principal } from '../auth/principal';
import { ApiError, notFound } from '../common/api-error';
import { validateDocumentUpload, type UploadedFile } from './document.validation';
import { DocumentsRepository } from './documents.repository';

const forbidden = (message: string) => new ApiError(403, 'FORBIDDEN', message);

const pgCode = (err: unknown) => (typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined);

/** A reference that is not even a well-formed id (pg 22P02) does not exist. */
async function orNotFound<T>(what: string, lookup: () => Promise<T | null | false>): Promise<T> {
  const found = await lookup().catch((err) => {
    if (pgCode(err) === '22P02') return null;
    throw err;
  });
  if (!found) throw notFound(what);
  return found as T;
}

const isHr = (p: Principal) => p.roles.includes(HR_ROLE);

/** HR sees every document; an employee sees only their own (an employee's userId is their employee id). */
const canView = (p: Principal, employeeId: string) => isHr(p) || p.userId === employeeId;

@Injectable()
export class DocumentsService {
  constructor(@Inject(DocumentsRepository) private readonly repo: DocumentsRepository) {}

  async list(p: Principal, employeeId: string) {
    if (!canView(p, employeeId)) throw forbidden('You cannot see this employee\'s documents');
    await orNotFound('Employee', () => this.repo.employeeExists(p.tenantId, employeeId));
    return { documents: await this.repo.list(p.tenantId, employeeId), canUpload: isHr(p) };
  }

  async upload(p: Principal, employeeId: string, input: { docType: unknown; file: UploadedFile | undefined }) {
    if (!isHr(p)) throw forbidden('Only HR can add documents');
    const r = validateDocumentUpload(input);
    if (!r.ok) throw new ApiError(422, 'VALIDATION_FAILED', 'The document was not uploaded.', r.fieldErrors);
    const { docType, fileName, contentType, content } = r.value;
    await this.repo.transaction(async (tx) => {
      await orNotFound('Employee', () => tx.employeeExists(p.tenantId, employeeId));
      await tx.insert(p.tenantId, employeeId, randomUUID(), { docType, fileName, contentType, content, uploadedBy: p.userId });
      await tx.audit({
        tenantId: p.tenantId,
        actorId: p.userId,
        action: 'employee.document_uploaded',
        entityType: 'employee',
        entityId: employeeId,
        detail: { docType, fileName },
      });
    });
  }

  async download(p: Principal, employeeId: string, id: string) {
    if (!canView(p, employeeId)) throw forbidden('You cannot see this employee\'s documents');
    return orNotFound('Document', () => this.repo.getContent(p.tenantId, employeeId, id));
  }
}

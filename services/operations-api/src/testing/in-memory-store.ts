import type { AuditEntry } from '../audit/audit.repository';
import { ApiError } from '../common/api-error';
import { DepartmentsRepository, type DepartmentDto, type DepartmentsTx } from '../departments/departments.repository';
import {
  EmployeesRepository,
  type EmergencyContactInput,
  type EmployeeFields,
  type EmployeeRecord,
  type EmployeesTx,
} from '../employees/employees.repository';

import {
  DocumentsRepository,
  FORMATS,
  type DocumentsTx,
  type NewDocument,
} from '../documents/documents.repository';

type Dept = { id: string; tenantId: string; name: string };
type Doc = NewDocument & { id: string; tenantId: string; employeeId: string; uploadedAt: Date };
type Emp = { id: string; tenantId: string; fields: EmployeeFields; contacts: EmergencyContactInput[] };

/** Shared in-memory state behind both repositories, so specs can observe cross-aggregate effects. */
export class InMemoryStore {
  departments: Dept[] = [];
  employees: Emp[] = [];
  audit: AuditEntry[] = [];
  documents: Doc[] = [];

  seedDocument(tenantId: string, employeeId: string, id: string, fileName: string, docType: NewDocument['docType'] = 'contract') {
    this.documents.push({
      id,
      tenantId,
      employeeId,
      docType,
      fileName,
      contentType: 'application/pdf',
      content: Buffer.from('%PDF-seed'),
      uploadedBy: 'seed',
      uploadedAt: new Date('2025-02-02T00:00:00Z'),
    });
  }

  seedDepartment(tenantId: string, id: string, name: string) {
    this.departments.push({ id, tenantId, name });
  }

  seedEmployee(tenantId: string, id: string, fields: EmployeeFields) {
    this.employees.push({ id, tenantId, fields, contacts: [] });
  }

  private count(d: Dept) {
    return this.employees.filter((e) => e.tenantId === d.tenantId && e.fields.departmentId === d.id).length;
  }

  dto(d: Dept): DepartmentDto {
    return { id: d.id, name: d.name, employeeCount: this.count(d) };
  }

  record(tenantId: string, id: string): EmployeeRecord | null {
    const e = this.employees.find((x) => x.tenantId === tenantId && x.id === id);
    if (!e) return null;
    const dept = this.departments.find((d) => d.id === e.fields.departmentId)!;
    const mgr = this.employees.find((m) => m.id === e.fields.managerId);
    const { fields } = e;
    return {
      id: e.id,
      fullName: fields.fullName,
      dateOfBirth: fields.dateOfBirth,
      workEmail: fields.workEmail,
      phone: fields.phone,
      jobTitle: fields.jobTitle,
      startDate: fields.startDate,
      department: { id: dept.id, name: dept.name },
      manager: mgr ? { id: mgr.id, fullName: mgr.fields.fullName } : null,
      emergencyContacts: e.contacts.map((c) => ({ ...c })),
    };
  }
}

export class InMemoryDepartmentsRepository extends DepartmentsRepository {
  constructor(private readonly store: InMemoryStore) {
    super();
  }

  async list(tenantId: string) {
    return this.store.departments.filter((d) => d.tenantId === tenantId).map((d) => this.store.dto(d));
  }

  async transaction<T>(work: (tx: DepartmentsTx) => Promise<T>): Promise<T> {
    const s = this.store;
    const find = (t: string, id: string) => s.departments.find((d) => d.tenantId === t && d.id === id);
    return work({
      find: async (t, id) => {
        const d = find(t, id);
        return d ? s.dto(d) : null;
      },
      nameTaken: async (t, name, exceptId) =>
        s.departments.some((d) => d.tenantId === t && d.id !== exceptId && d.name.toLowerCase() === name.toLowerCase()),
      insert: async (t, id, name) => {
        const d = { id, tenantId: t, name };
        s.departments.push(d);
        return s.dto(d);
      },
      rename: async (t, id, name) => {
        find(t, id)!.name = name;
      },
      remove: async (t, id) => {
        const d = find(t, id)!;
        if (s.dto(d).employeeCount > 0) throw new ApiError(409, 'DEPARTMENT_HAS_EMPLOYEES', 'The department still has employees');
        s.departments = s.departments.filter((x) => x !== d);
      },
      audit: async (entry) => {
        s.audit.push(entry);
      },
    });
  }
}

export class InMemoryEmployeesRepository extends EmployeesRepository {
  constructor(private readonly store: InMemoryStore) {
    super();
  }

  async get(tenantId: string, id: string) {
    return this.store.record(tenantId, id);
  }

  async options(tenantId: string) {
    return this.store.employees.filter((e) => e.tenantId === tenantId).map((e) => ({ id: e.id, fullName: e.fields.fullName }));
  }

  async transaction<T>(work: (tx: EmployeesTx) => Promise<T>): Promise<T> {
    const s = this.store;
    const find = (t: string, id: string) => s.employees.find((e) => e.tenantId === t && e.id === id)!;
    return work({
      departmentExists: async (t, id) => s.departments.some((d) => d.tenantId === t && d.id === id),
      employeeExists: async (t, id) => s.employees.some((e) => e.tenantId === t && e.id === id),
      insert: async (t, id, fields) => {
        s.employees.push({ id, tenantId: t, fields: { ...fields }, contacts: [] });
      },
      update: async (t, id, patch) => {
        Object.assign(find(t, id).fields, patch);
      },
      replaceContacts: async (t, id, contacts) => {
        find(t, id).contacts = contacts.map((c) => ({ ...c }));
      },
      get: async (t, id) => s.record(t, id),
      audit: async (entry) => {
        s.audit.push(entry);
      },
    });
  }
}

export class InMemoryDocumentsRepository extends DocumentsRepository {
  constructor(private readonly store: InMemoryStore) {
    super();
  }

  private hasEmployee(t: string, id: string) {
    return this.store.employees.some((e) => e.tenantId === t && e.id === id);
  }

  async employeeExists(tenantId: string, employeeId: string) {
    return this.hasEmployee(tenantId, employeeId);
  }

  async list(tenantId: string, employeeId: string) {
    return this.store.documents
      .filter((d) => d.tenantId === tenantId && d.employeeId === employeeId)
      .map((d) => ({
        id: d.id,
        docType: d.docType,
        fileName: d.fileName,
        format: FORMATS[d.contentType],
        uploadedAt: d.uploadedAt.toISOString(),
      }));
  }

  async getContent(tenantId: string, employeeId: string, id: string) {
    const d = this.store.documents.find((x) => x.tenantId === tenantId && x.employeeId === employeeId && x.id === id);
    return d ? { fileName: d.fileName, contentType: d.contentType, content: d.content } : null;
  }

  async transaction<T>(work: (tx: DocumentsTx) => Promise<T>): Promise<T> {
    const s = this.store;
    return work({
      employeeExists: async (t, id) => this.hasEmployee(t, id),
      insert: async (t, employeeId, id, doc) => {
        s.documents.push({ ...doc, id, tenantId: t, employeeId, uploadedAt: new Date() });
      },
      audit: async (entry) => {
        s.audit.push(entry);
      },
    });
  }
}

import type { Principal } from '../auth/principal';
import { InMemoryDocumentsRepository, InMemoryStore } from '../testing/in-memory-store';
import { DocumentsService } from './documents.service';

const empId = 'ana';
const hr: Principal = { userId: 'hr-1', tenantId: 't1', roles: ['hr'] };
const hrOfOtherTenant: Principal = { userId: 'hr-2', tenantId: 't2', roles: ['hr'] };
const emp: Principal = { userId: empId, tenantId: 't1', roles: ['employee'] };
const otherEmployee: Principal = { userId: 'bob', tenantId: 't1', roles: ['employee'] };

const pdf = (name: string) => ({
  originalname: name,
  mimetype: 'application/pdf',
  size: 12,
  buffer: Buffer.from('%PDF-1.4 test'),
});

function setup() {
  const store = new InMemoryStore();
  store.seedDepartment('t1', 'design', 'Design');
  store.seedEmployee('t1', empId, {
    fullName: 'Ana Costa',
    dateOfBirth: null,
    workEmail: null,
    phone: null,
    jobTitle: 'Head of Design',
    departmentId: 'design',
    managerId: null,
    startDate: '2020-01-06',
  });
  return { store, service: new DocumentsService(new InMemoryDocumentsRepository(store)) };
}

describe('DocumentsService.upload', () => {
  it('lists an uploaded document and audits it (AC1)', async () => {
    const { store, service } = setup();
    await service.upload(hr, empId, { docType: 'contract', file: pdf('contract.pdf') });
    const res = await service.list(hr, empId);
    expect(res.documents.map((d) => d.fileName)).toContain('contract.pdf');
    expect(res.canUpload).toBe(true);
    expect(store.audit.at(-1)).toMatchObject({
      action: 'employee.document_uploaded',
      entityId: empId,
      detail: { docType: 'contract', fileName: 'contract.pdf' },
    });
  });

  it('refuses the employee before validating and stores nothing (AC5)', async () => {
    const { store, service } = setup();
    await expect(service.upload(emp, empId, { docType: 'id', file: pdf('x.pdf') })).rejects.toMatchObject({ status: 403 });
    await expect(service.upload(emp, empId, { docType: 'id', file: undefined })).rejects.toMatchObject({ status: 403 });
    expect(store.documents).toHaveLength(0);
  });

  it('refuses a type that is not allowed and stores nothing (AC7, AC8)', async () => {
    const { store, service } = setup();
    const bad = { originalname: 'a.pdf', mimetype: 'application/pdf', size: 8, buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) };
    await expect(service.upload(hr, empId, { docType: 'contract', file: bad })).rejects.toMatchObject({
      status: 422,
      fieldErrors: { file: expect.stringContaining('PDF, JPG, PNG') },
    });
    expect(store.documents).toHaveLength(0);
  });

  it('refuses a file over the maximum and stores nothing (AC9, AC10)', async () => {
    const { store, service } = setup();
    const big = { ...pdf('big.pdf'), size: 10 * 1024 * 1024 + 1 };
    await expect(service.upload(hr, empId, { docType: 'contract', file: big })).rejects.toMatchObject({
      status: 422,
      fieldErrors: { file: expect.stringContaining('10 MB') },
    });
    expect(store.documents).toHaveLength(0);
  });

  it('404s for an employee in another tenant', async () => {
    const { service } = setup();
    await expect(service.upload(hrOfOtherTenant, empId, { docType: 'id', file: pdf('x.pdf') })).rejects.toMatchObject({ status: 404 });
  });
});

describe('DocumentsService.list and download', () => {
  it('lists documents HR did not upload (AC2)', async () => {
    const { store, service } = setup();
    store.seedDocument('t1', empId, 'd1', 'a.pdf');
    store.seedDocument('t1', empId, 'd2', 'b.pdf', 'id');
    expect((await service.list(hr, empId)).documents).toHaveLength(2);
  });

  it('lists the employee their own documents without upload (AC3)', async () => {
    const { store, service } = setup();
    ['d1', 'd2', 'd3'].forEach((id) => store.seedDocument('t1', empId, id, `${id}.pdf`));
    const own = await service.list(emp, empId);
    expect(own.documents).toHaveLength(3);
    expect(own.canUpload).toBe(false);
  });

  it('refuses anyone else and other tenants (AC6)', async () => {
    const { store, service } = setup();
    store.seedDocument('t1', empId, 'd1', 'a.pdf');
    await expect(service.list(otherEmployee, empId)).rejects.toMatchObject({ status: 403 });
    await expect(service.list(hrOfOtherTenant, empId)).rejects.toMatchObject({ status: 404 });
    await expect(service.download(otherEmployee, empId, 'd1')).rejects.toMatchObject({ status: 403 });
    await expect(service.download(hrOfOtherTenant, empId, 'd1')).rejects.toMatchObject({ status: 404 });
  });

  it('downloads for HR and for the owner, and 404s an unknown document', async () => {
    const { store, service } = setup();
    store.seedDocument('t1', empId, 'd1', 'a.pdf');
    expect(await service.download(hr, empId, 'd1')).toMatchObject({ fileName: 'a.pdf', contentType: 'application/pdf' });
    expect(await service.download(emp, empId, 'd1')).toMatchObject({ fileName: 'a.pdf' });
    await expect(service.download(hr, empId, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});

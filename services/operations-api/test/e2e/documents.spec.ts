import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { documentCount, seedTopOfOrg } from './db';

test.skip(!process.env.DATABASE_URL, 'needs a migrated PostgreSQL (DATABASE_URL)');

const tenant = randomUUID();
const hr = { 'x-user-id': 'hr-1', 'x-tenant-id': tenant, 'x-roles': 'hr' };
const otherTenantHr = { 'x-user-id': 'hr-2', 'x-tenant-id': randomUUID(), 'x-roles': 'hr' };

let empId: string;
let own: Record<string, string>;
let stranger: Record<string, string>;

test.beforeAll(async ({ request }) => {
  const dept = (await (await request.post('/departments', { headers: hr, data: { name: 'Design' } })).json()).id;
  empId = await seedTopOfOrg(tenant, dept);
  own = { 'x-user-id': empId, 'x-tenant-id': tenant, 'x-roles': 'employee' };
  stranger = { 'x-user-id': randomUUID(), 'x-tenant-id': tenant, 'x-roles': 'employee' };
});

const pdf = (name = 'contract.pdf', size = 64) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size)]),
});
const url = () => `/employees/${empId}/documents`;

test('HR uploads a document and it is listed and downloadable', async ({ request }) => {
  const res = await request.post(url(), { headers: hr, multipart: { docType: 'contract', file: pdf() } });
  expect(res.status()).toBe(201);
  const list = await (await request.get(url(), { headers: hr })).json();
  expect(list.canUpload).toBe(true);
  expect(list.documents).toMatchObject([{ docType: 'contract', fileName: 'contract.pdf', format: 'PDF' }]);
  const file = await request.get(`${url()}/${list.documents[0].id}/content`, { headers: hr });
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toContain('application/pdf');
  expect(file.headers()['x-content-type-options']).toBe('nosniff');
});

test('the employee lists their own documents but cannot upload', async ({ request }) => {
  const before = await documentCount(tenant);
  const list = await request.get(url(), { headers: own });
  expect(list.status()).toBe(200);
  expect((await list.json()).canUpload).toBe(false);
  const res = await request.post(url(), { headers: own, multipart: { docType: 'id', file: pdf('mine.pdf') } });
  expect(res.status()).toBe(403);
  expect(await documentCount(tenant)).toBe(before);
});

test('another employee and another tenant cannot see the documents', async ({ request }) => {
  expect((await request.get(url(), { headers: stranger })).status()).toBe(403);
  expect((await request.get(url(), { headers: otherTenantHr })).status()).toBe(404);
});

test('a file type that is not allowed is refused with the allowed types named', async ({ request }) => {
  const before = await documentCount(tenant);
  const res = await request.post(url(), {
    headers: hr,
    multipart: { docType: 'contract', file: { name: 'notes.docx', mimeType: 'application/msword', buffer: Buffer.from('hello') } },
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).fieldErrors.file).toContain('PDF, JPG, PNG');
  expect(await documentCount(tenant)).toBe(before);
});

test('a file over 10 MB is refused with the maximum named', async ({ request }) => {
  const before = await documentCount(tenant);
  const res = await request.post(url(), { headers: hr, multipart: { docType: 'contract', file: pdf('big.pdf', 11 * 1024 * 1024) } });
  expect(res.status()).toBe(422);
  expect((await res.json()).fieldErrors.file).toContain('10 MB');
  expect(await documentCount(tenant)).toBe(before);
});

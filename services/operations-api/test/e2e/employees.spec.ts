import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { auditActions, seedTopOfOrg, tryUpdateAudit } from './db';

test.skip(!process.env.DATABASE_URL, 'needs a migrated PostgreSQL (DATABASE_URL)');

const tenant = randomUUID();
const hr = { 'x-user-id': 'hr-1', 'x-tenant-id': tenant, 'x-roles': 'hr' };
const staff = { 'x-user-id': 'emp-1', 'x-tenant-id': tenant, 'x-roles': 'employee' };
const otherHr = { 'x-user-id': 'hr-2', 'x-tenant-id': randomUUID(), 'x-roles': 'hr' };

let design: string;
let research: string;
let managerId: string;

test.beforeAll(async ({ request }) => {
  design = (await (await request.post('/departments', { headers: hr, data: { name: 'Design' } })).json()).id;
  research = (await (await request.post('/departments', { headers: hr, data: { name: 'Research' } })).json()).id;
  managerId = await seedTopOfOrg(tenant, design);
});

const valid = () => ({ fullName: 'Priya Shah', jobTitle: 'Product Designer', departmentId: design, managerId, startDate: '2026-03-02' });

test('HR creates a record with required fields only', async ({ request }) => {
  const res = await request.post('/employees', { headers: hr, data: valid() });
  expect(res.status()).toBe(201);
  const rec = await (await request.get(`/employees/${(await res.json()).id}`, { headers: hr })).json();
  expect(rec).toMatchObject({
    jobTitle: 'Product Designer',
    startDate: '2026-03-02',
    department: { id: design, name: 'Design' },
    manager: { id: managerId, fullName: 'Ana Costa' },
    workEmail: null,
    emergencyContacts: [],
  });
});

test('HR creates and edits personal, contact and emergency contact details', async ({ request }) => {
  const created = await request.post('/employees', {
    headers: hr,
    data: {
      ...valid(),
      dateOfBirth: '1990-07-14',
      workEmail: 'priya.shah@example.com',
      phone: '+44 7700 900123',
      emergencyContacts: [
        { name: 'Raj Shah', relationship: 'Spouse', phone: '+44 7700 900456' },
        { name: 'Mira Shah', relationship: 'Sister', phone: '+44 7700 900777' },
      ],
    },
  });
  const { id } = await created.json();
  const rec = await (await request.get(`/employees/${id}`, { headers: hr })).json();
  expect(rec).toMatchObject({ dateOfBirth: '1990-07-14', workEmail: 'priya.shah@example.com' });
  expect(rec.emergencyContacts.map((c: { name: string }) => c.name)).toEqual(['Raj Shah', 'Mira Shah']);

  const patched = await request.patch(`/employees/${id}`, {
    headers: hr,
    data: { jobTitle: 'Staff Designer', departmentId: research, phone: '+44 7700 900999', emergencyContacts: [{ name: 'Mira Shah', relationship: 'Sister', phone: '1' }] },
  });
  expect(patched.status()).toBe(200);
  expect(await patched.json()).toMatchObject({
    jobTitle: 'Staff Designer',
    department: { id: research, name: 'Research' },
    phone: '+44 7700 900999',
    emergencyContacts: [{ name: 'Mira Shah' }],
  });
});

for (const field of ['fullName', 'jobTitle', 'departmentId', 'managerId', 'startDate']) {
  test(`a record missing ${field} is not saved`, async ({ request }) => {
    const before = await (await request.get('/employees/options', { headers: hr })).json();
    const { [field]: _omit, ...data } = valid() as Record<string, string>;
    const res = await request.post('/employees', { headers: hr, data });
    expect(res.status()).toBe(422);
    expect((await res.json()).fieldErrors).toHaveProperty(field);
    expect(await (await request.get('/employees/options', { headers: hr })).json()).toEqual(before);
  });
}

test('an unknown department is rejected', async ({ request }) => {
  const res = await request.post('/employees', { headers: hr, data: { ...valid(), departmentId: randomUUID() } });
  expect(res.status()).toBe(422);
});

test('non-HR and anonymous callers cannot create or edit employees', async ({ request }) => {
  const before = await (await request.get('/employees/options', { headers: hr })).json();
  expect((await request.post('/employees', { headers: staff, data: valid() })).status()).toBe(403);
  expect((await request.patch(`/employees/${managerId}`, { headers: staff, data: { jobTitle: 'X' } })).status()).toBe(403);
  expect((await request.post('/employees', { data: valid() })).status()).toBe(401);
  expect(await (await request.get('/employees/options', { headers: hr })).json()).toEqual(before);
  expect((await (await request.get(`/employees/${managerId}`, { headers: hr })).json()).jobTitle).toBe('Head of Design');
});

test("another tenant's HR cannot read or change an employee", async ({ request }) => {
  expect((await request.get(`/employees/${managerId}`, { headers: otherHr })).status()).toBe(404);
  expect((await request.patch(`/employees/${managerId}`, { headers: otherHr, data: { jobTitle: 'X' } })).status()).toBe(404);
});

test('writes are audited and the audit log is append-only', async ({ request }) => {
  await request.post('/employees', { headers: hr, data: valid() });
  expect(await auditActions(tenant)).toContain('employee.created');
  expect(await tryUpdateAudit(tenant)).toMatch(/append-only/);
});

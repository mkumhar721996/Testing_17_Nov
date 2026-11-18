import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { seedTopOfOrg } from './db';

test.skip(!process.env.DATABASE_URL, 'needs a migrated PostgreSQL (DATABASE_URL)');

const tenant = randomUUID();
const hr = { 'x-user-id': 'hr-1', 'x-tenant-id': tenant, 'x-roles': 'hr' };
const staff = { 'x-user-id': 'emp-1', 'x-tenant-id': tenant, 'x-roles': 'employee' };
const otherHr = { 'x-user-id': 'hr-2', 'x-tenant-id': randomUUID(), 'x-roles': 'hr' };

test('HR adds, renames and removes a department', async ({ request }) => {
  const added = await request.post('/departments', { headers: hr, data: { name: 'Legal' } });
  expect(added.status()).toBe(201);
  const { id } = await added.json();

  const dup = await request.post('/departments', { headers: hr, data: { name: 'legal' } });
  expect(dup.status()).toBe(409);
  const blank = await request.post('/departments', { headers: hr, data: { name: '  ' } });
  expect(blank.status()).toBe(400);

  const renamed = await request.patch(`/departments/${id}`, { headers: hr, data: { name: 'Legal & Risk' } });
  expect(await renamed.json()).toMatchObject({ id, name: 'Legal & Risk' });

  expect((await request.delete(`/departments/${id}`, { headers: hr })).status()).toBe(204);
  const list = await (await request.get('/departments', { headers: hr })).json();
  expect(list.map((d: { id: string }) => d.id)).not.toContain(id);
});

test('a department with employees is renamed everywhere and cannot be removed', async ({ request }) => {
  const eng = await (await request.post('/departments', { headers: hr, data: { name: 'Engineering' } })).json();
  const managerId = await seedTopOfOrg(tenant, eng.id);
  const created = await request.post('/employees', {
    headers: hr,
    data: { fullName: 'Dev Patel', jobTitle: 'Engineer', departmentId: eng.id, managerId, startDate: '2026-03-02' },
  });
  const employeeId = (await created.json()).id;

  expect((await request.delete(`/departments/${eng.id}`, { headers: hr })).status()).toBe(409);
  const list = await (await request.get('/departments', { headers: hr })).json();
  expect(list.find((d: { id: string }) => d.id === eng.id)).toMatchObject({ name: 'Engineering', employeeCount: 2 });

  await request.patch(`/departments/${eng.id}`, { headers: hr, data: { name: 'Platform' } });
  for (const id of [managerId, employeeId]) {
    const rec = await (await request.get(`/employees/${id}`, { headers: hr })).json();
    expect(rec.department).toEqual({ id: eng.id, name: 'Platform' });
  }
});

test('non-HR and anonymous callers cannot change departments', async ({ request }) => {
  const before = await (await request.get('/departments', { headers: hr })).json();
  const { id } = await (await request.post('/departments', { headers: hr, data: { name: 'Kept' } })).json();

  expect((await request.post('/departments', { headers: staff, data: { name: 'Nope' } })).status()).toBe(403);
  expect((await request.patch(`/departments/${id}`, { headers: staff, data: { name: 'Nope' } })).status()).toBe(403);
  expect((await request.delete(`/departments/${id}`, { headers: staff })).status()).toBe(403);
  expect((await request.post('/departments', { data: { name: 'Nope' } })).status()).toBe(401);

  const after = await (await request.get('/departments', { headers: hr })).json();
  expect(after).toHaveLength(before.length + 1);
  expect(after.map((d: { name: string }) => d.name)).not.toContain('Nope');
  // Any signed-in user can read the list.
  expect((await request.get('/departments', { headers: staff })).status()).toBe(200);
});

test("another tenant's HR cannot see or change a department", async ({ request }) => {
  const { id } = await (await request.post('/departments', { headers: hr, data: { name: 'Private' } })).json();
  expect(await (await request.get('/departments', { headers: otherHr })).json()).toEqual([]);
  expect((await request.patch(`/departments/${id}`, { headers: otherHr, data: { name: 'X' } })).status()).toBe(404);
  expect((await request.delete(`/departments/${id}`, { headers: otherHr })).status()).toBe(404);
});

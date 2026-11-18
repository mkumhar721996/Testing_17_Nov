import type { Principal } from '../auth/principal';
import { InMemoryEmployeesRepository, InMemoryStore } from '../testing/in-memory-store';
import type { EmployeeInput } from './employee.validation';
import { EmployeesService } from './employees.service';

const hr: Principal = { userId: 'hr-1', tenantId: 't1', roles: ['hr'] };
const otherHr: Principal = { userId: 'hr-2', tenantId: 't2', roles: ['hr'] };

function setup() {
  const store = new InMemoryStore();
  store.seedDepartment('t1', 'design', 'Design');
  store.seedDepartment('t1', 'research', 'Research');
  store.seedDepartment('t2', 'other', 'Other');
  store.seedEmployee('t1', 'ana', {
    fullName: 'Ana Costa',
    dateOfBirth: null,
    workEmail: null,
    phone: null,
    jobTitle: 'Head of Design',
    departmentId: 'design',
    managerId: null,
    startDate: '2020-01-06',
  });
  store.seedEmployee('t2', 'zed', { ...store.employees[0].fields, fullName: 'Zed', departmentId: 'other' });
  const service = new EmployeesService(new InMemoryEmployeesRepository(store));
  const validInput: EmployeeInput = {
    fullName: 'Priya Shah',
    jobTitle: 'Product Designer',
    departmentId: 'design',
    managerId: 'ana',
    startDate: '2026-03-02',
    dateOfBirth: null,
    workEmail: null,
    phone: null,
    emergencyContacts: [],
  };
  return { store, service, validInput };
}

describe('EmployeesService.create', () => {
  it('stores and returns the four job details (AC1)', async () => {
    const { service, validInput } = setup();
    const created = await service.create(hr, validInput);
    const rec = await service.get(hr, created.id);
    expect(rec).toMatchObject({
      jobTitle: 'Product Designer',
      department: { id: 'design', name: 'Design' },
      manager: { id: 'ana', fullName: 'Ana Costa' },
      startDate: '2026-03-02',
    });
  });

  it('stores personal, contact and emergency contacts in order (AC3)', async () => {
    const { service, validInput } = setup();
    const created = await service.create(hr, {
      ...validInput,
      dateOfBirth: '1990-07-14',
      workEmail: 'priya.shah@example.com',
      phone: '+44 7700 900123',
      emergencyContacts: [
        { name: 'Raj Shah', relationship: 'Spouse', phone: '+44 7700 900456' },
        { name: 'Mira Shah', relationship: 'Sister', phone: '+44 7700 900777' },
      ],
    });
    const rec = await service.get(hr, created.id);
    expect(rec).toMatchObject({
      fullName: 'Priya Shah',
      dateOfBirth: '1990-07-14',
      workEmail: 'priya.shah@example.com',
      phone: '+44 7700 900123',
    });
    expect(rec.emergencyContacts.map((c) => c.name)).toEqual(['Raj Shah', 'Mira Shah']);
  });

  it('saves with contact details and emergency contacts empty (AC9)', async () => {
    const { service, validInput } = setup();
    const created = await service.create(hr, validInput);
    const rec = await service.get(hr, created.id);
    expect(rec.emergencyContacts).toEqual([]);
    expect(rec.workEmail).toBeNull();
  });

  it('writes one audit entry', async () => {
    const { service, validInput, store } = setup();
    const created = await service.create(hr, validInput);
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ tenantId: 't1', actorId: 'hr-1', action: 'employee.created', entityId: created.id });
  });

  it('rejects an unknown or other-tenant department with 422 and saves nothing (AC5)', async () => {
    const { service, validInput, store } = setup();
    await expect(service.create(hr, { ...validInput, departmentId: 'other' })).rejects.toMatchObject({ status: 422 });
    await expect(service.create(hr, { ...validInput, departmentId: 'nope' })).rejects.toMatchObject({ status: 422 });
    expect(store.employees).toHaveLength(2);
    expect(store.audit).toHaveLength(0);
  });

  it('rejects an unknown or other-tenant manager with 422', async () => {
    const { service, validInput } = setup();
    await expect(service.create(hr, { ...validInput, managerId: 'zed' })).rejects.toMatchObject({
      status: 422,
      fieldErrors: { managerId: expect.any(String) },
    });
  });
});

describe('EmployeesService.update', () => {
  async function existing() {
    const ctx = setup();
    const created = await ctx.service.create(hr, ctx.validInput);
    return { ...ctx, id: created.id };
  }

  it('changes the job title only (AC2)', async () => {
    const { service, id } = await existing();
    const before = await service.get(hr, id);
    await service.update(hr, id, { jobTitle: 'Staff Engineer' });
    const after = await service.get(hr, id);
    expect(after.jobTitle).toBe('Staff Engineer');
    expect(after.department.id).toBe(before.department.id);
    expect(after.manager).toEqual(before.manager);
    expect(after.startDate).toBe(before.startDate);
  });

  it('changes department, manager and start date (AC2, AC5)', async () => {
    const { service, id, store } = await existing();
    store.seedEmployee('t1', 'dev', { ...store.employees[0].fields, fullName: 'Dev Patel' });
    await service.update(hr, id, { departmentId: 'research', managerId: 'dev', startDate: '2026-04-01' });
    const rec = await service.get(hr, id);
    expect(rec.department).toEqual({ id: 'research', name: 'Research' });
    expect(rec.manager).toEqual({ id: 'dev', fullName: 'Dev Patel' });
    expect(rec.startDate).toBe('2026-04-01');
  });

  it('changes personal and contact details and replaces emergency contacts (AC4)', async () => {
    const { service, id } = await existing();
    await service.update(hr, id, { emergencyContacts: [{ name: 'Raj Shah', relationship: 'Spouse', phone: '1' }] });
    await service.update(hr, id, {
      fullName: 'Priya S',
      phone: '+44 7700 900999',
      emergencyContacts: [{ name: 'Mira Shah', relationship: 'Sister', phone: '+44 7700 900777' }],
    });
    const rec = await service.get(hr, id);
    expect(rec).toMatchObject({ fullName: 'Priya S', phone: '+44 7700 900999' });
    expect(rec.emergencyContacts).toEqual([expect.objectContaining({ name: 'Mira Shah' })]);
  });

  it('keeps emergency contacts when the patch does not mention them', async () => {
    const { service, id } = await existing();
    await service.update(hr, id, { emergencyContacts: [{ name: 'Raj Shah', relationship: 'Spouse', phone: '1' }] });
    await service.update(hr, id, { phone: '2' });
    expect((await service.get(hr, id)).emergencyContacts).toHaveLength(1);
  });

  it('rejects an other-tenant department with 422 and changes nothing', async () => {
    const { service, id } = await existing();
    await expect(service.update(hr, id, { departmentId: 'other' })).rejects.toMatchObject({ status: 422 });
    expect((await service.get(hr, id)).department.id).toBe('design');
  });

  it('rejects the employee as their own manager', async () => {
    const { service, id } = await existing();
    await expect(service.update(hr, id, { managerId: id })).rejects.toMatchObject({ status: 422 });
  });

  it('writes one audit entry per update', async () => {
    const { service, id, store } = await existing();
    await service.update(hr, id, { jobTitle: 'Lead' });
    expect(store.audit.filter((a) => a.action === 'employee.updated')).toHaveLength(1);
  });
});

describe('tenant isolation', () => {
  it("cannot read or change another tenant's employee (404)", async () => {
    const { service, store } = setup();
    await expect(service.get(otherHr, 'ana')).rejects.toMatchObject({ status: 404 });
    await expect(service.update(otherHr, 'ana', { jobTitle: 'Hacked' })).rejects.toMatchObject({ status: 404 });
    expect(store.employees[0].fields.jobTitle).toBe('Head of Design');
  });

  it('lists only the tenant’s employees as manager options', async () => {
    const { service } = setup();
    expect(await service.options(hr)).toEqual([{ id: 'ana', fullName: 'Ana Costa' }]);
  });
});

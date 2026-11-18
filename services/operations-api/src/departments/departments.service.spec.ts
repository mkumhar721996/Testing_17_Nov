import type { Principal } from '../auth/principal';
import { EmployeesService } from '../employees/employees.service';
import { InMemoryDepartmentsRepository, InMemoryEmployeesRepository, InMemoryStore } from '../testing/in-memory-store';
import { DepartmentsService } from './departments.service';

const hr: Principal = { userId: 'hr-1', tenantId: 't1', roles: ['hr'] };
const otherHr: Principal = { userId: 'hr-2', tenantId: 't2', roles: ['hr'] };

function setup() {
  const store = new InMemoryStore();
  store.seedDepartment('t1', 'eng', 'Engineering');
  store.seedDepartment('t1', 'res', 'Research');
  store.seedDepartment('t2', 'x', 'Other tenant dept');
  const fields = { dateOfBirth: null, workEmail: null, phone: null, managerId: null, startDate: '2026-01-05' };
  store.seedEmployee('t1', 'e1', { ...fields, fullName: 'Priya Shah', jobTitle: 'Engineer', departmentId: 'eng' });
  store.seedEmployee('t1', 'e2', { ...fields, fullName: 'Dev Patel', jobTitle: 'Engineer', departmentId: 'eng' });
  return {
    store,
    departments: new DepartmentsService(new InMemoryDepartmentsRepository(store)),
    employees: new EmployeesService(new InMemoryEmployeesRepository(store)),
  };
}

describe('DepartmentsService', () => {
  it('lists departments with their employee counts', async () => {
    const { departments } = setup();
    expect(await departments.list(hr)).toEqual([
      { id: 'eng', name: 'Engineering', employeeCount: 2 },
      { id: 'res', name: 'Research', employeeCount: 0 },
    ]);
  });

  it('offers an added department in the list and audits it', async () => {
    const { departments, store } = setup();
    const d = await departments.add(hr, 'Legal');
    expect((await departments.list(hr)).map((x) => x.name)).toContain('Legal');
    expect(d).toMatchObject({ name: 'Legal', employeeCount: 0 });
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ tenantId: 't1', actorId: 'hr-1', action: 'department.added', entityId: d.id });
  });

  it('rejects a blank name with 400 and adds nothing', async () => {
    const { departments, store } = setup();
    await expect(departments.add(hr, '   ')).rejects.toMatchObject({ status: 400 });
    expect(store.departments).toHaveLength(3);
    expect(store.audit).toHaveLength(0);
  });

  it('rejects a duplicate name, ignoring case, with 409', async () => {
    const { departments } = setup();
    await expect(departments.add(hr, 'engineering')).rejects.toMatchObject({ status: 409 });
  });

  it('allows the same name in another tenant', async () => {
    const { departments } = setup();
    await expect(departments.add(otherHr, 'Engineering')).resolves.toMatchObject({ name: 'Engineering' });
  });

  it('renames so every employee in the department shows the new name', async () => {
    const { departments, employees, store } = setup();
    await departments.rename(hr, 'eng', 'Platform');
    for (const id of ['e1', 'e2']) expect((await employees.get(hr, id)).department.name).toBe('Platform');
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ action: 'department.renamed' });
  });

  it('rejects renaming to another department name with 409', async () => {
    const { departments } = setup();
    await expect(departments.rename(hr, 'eng', 'research')).rejects.toMatchObject({ status: 409 });
  });

  it('refuses to remove a department with employees and keeps it', async () => {
    const { departments, store } = setup();
    await expect(departments.remove(hr, 'eng')).rejects.toMatchObject({ status: 409, code: 'DEPARTMENT_HAS_EMPLOYEES' });
    expect((await departments.list(hr)).map((d) => d.name)).toContain('Engineering');
    expect(store.audit).toHaveLength(0);
  });

  it('removes an empty department so it is no longer offered', async () => {
    const { departments, store } = setup();
    await departments.remove(hr, 'res');
    expect((await departments.list(hr)).map((d) => d.name)).not.toContain('Research');
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ action: 'department.removed' });
  });

  it("cannot see or change another tenant's departments (404)", async () => {
    const { departments, store } = setup();
    expect(await departments.list(otherHr)).toHaveLength(1);
    await expect(departments.rename(otherHr, 'eng', 'Hacked')).rejects.toMatchObject({ status: 404 });
    await expect(departments.remove(otherHr, 'res')).rejects.toMatchObject({ status: 404 });
    expect(store.departments.map((d) => d.name)).toContain('Engineering');
    expect(store.departments.map((d) => d.name)).toContain('Research');
  });
});

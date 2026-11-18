import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Principal } from '../auth/principal';
import { ApiError, notFound } from '../common/api-error';
import type { EmployeeInput, EmployeePatch } from './employee.validation';
import { EmployeesRepository, type EmployeeFields, type EmployeeRecord, type EmployeesTx } from './employees.repository';

const unprocessable = (fieldErrors: Record<string, string>) =>
  new ApiError(422, 'VALIDATION_FAILED', 'The record was not saved.', fieldErrors);

@Injectable()
export class EmployeesService {
  constructor(@Inject(EmployeesRepository) private readonly repo: EmployeesRepository) {}

  options(p: Principal) {
    return this.repo.options(p.tenantId);
  }

  async get(p: Principal, id: string): Promise<EmployeeRecord> {
    const record = await this.repo.get(p.tenantId, id);
    if (!record) throw notFound('Employee');
    return record;
  }

  create(p: Principal, input: EmployeeInput): Promise<EmployeeRecord> {
    const { emergencyContacts, ...fields } = input;
    return this.repo.transaction(async (tx) => {
      const id = randomUUID();
      await this.checkReferences(tx, p.tenantId, fields);
      await tx.insert(p.tenantId, id, fields);
      await tx.replaceContacts(p.tenantId, id, emergencyContacts);
      await tx.audit({
        tenantId: p.tenantId,
        actorId: p.userId,
        action: 'employee.created',
        entityType: 'employee',
        entityId: id,
        detail: { fullName: fields.fullName },
      });
      return (await tx.get(p.tenantId, id))!;
    });
  }

  update(p: Principal, id: string, patch: EmployeePatch): Promise<EmployeeRecord> {
    const { emergencyContacts, ...fields } = patch;
    return this.repo.transaction(async (tx) => {
      if (!(await tx.employeeExists(p.tenantId, id))) throw notFound('Employee');
      await this.checkReferences(tx, p.tenantId, fields, id);
      if (Object.keys(fields).length) await tx.update(p.tenantId, id, fields);
      if (emergencyContacts) await tx.replaceContacts(p.tenantId, id, emergencyContacts);
      await tx.audit({
        tenantId: p.tenantId,
        actorId: p.userId,
        action: 'employee.updated',
        entityType: 'employee',
        entityId: id,
        detail: { changed: [...Object.keys(fields), ...(emergencyContacts ? ['emergencyContacts'] : [])] },
      });
      return (await tx.get(p.tenantId, id))!;
    });
  }

  /** The department and manager must exist in the caller's tenant; nobody manages themselves. */
  private async checkReferences(tx: EmployeesTx, tenantId: string, f: Partial<EmployeeFields>, selfId?: string) {
    const errors: Record<string, string> = {};
    if (f.departmentId !== undefined && !(await tx.departmentExists(tenantId, f.departmentId))) {
      errors.departmentId = 'Choose a department from the list.';
    }
    if (f.managerId) {
      if (f.managerId === selfId) errors.managerId = 'An employee cannot be their own manager.';
      else if (!(await tx.employeeExists(tenantId, f.managerId))) errors.managerId = 'Choose a manager from the list.';
    }
    if (Object.keys(errors).length) throw unprocessable(errors);
  }
}

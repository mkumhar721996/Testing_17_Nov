import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Principal } from '../auth/principal';
import { ApiError, notFound } from '../common/api-error';
import { DepartmentsRepository, type DepartmentDto, type DepartmentsTx } from './departments.repository';

const duplicate = (name: string) => new ApiError(409, 'DEPARTMENT_EXISTS', `${name} already exists`);

function cleanName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new ApiError(400, 'NAME_REQUIRED', 'Enter a department name.');
  return trimmed;
}

@Injectable()
export class DepartmentsService {
  constructor(@Inject(DepartmentsRepository) private readonly repo: DepartmentsRepository) {}

  list(p: Principal): Promise<DepartmentDto[]> {
    return this.repo.list(p.tenantId);
  }

  async add(p: Principal, rawName: string): Promise<DepartmentDto> {
    const name = cleanName(rawName);
    return this.repo.transaction(async (tx) => {
      if (await tx.nameTaken(p.tenantId, name)) throw duplicate(name);
      const id = randomUUID();
      const dto = await tx.insert(p.tenantId, id, name);
      await this.audit(tx, p, 'department.added', id, { name });
      return dto;
    });
  }

  async rename(p: Principal, id: string, rawName: string): Promise<DepartmentDto> {
    const name = cleanName(rawName);
    return this.repo.transaction(async (tx) => {
      const current = await tx.find(p.tenantId, id);
      if (!current) throw notFound('Department');
      if (await tx.nameTaken(p.tenantId, name, id)) throw duplicate(name);
      // Employees reference the department by id, so none of their rows change.
      await tx.rename(p.tenantId, id, name);
      await this.audit(tx, p, 'department.renamed', id, { from: current.name, to: name });
      return { ...current, name };
    });
  }

  async remove(p: Principal, id: string): Promise<void> {
    await this.repo.transaction(async (tx) => {
      const current = await tx.find(p.tenantId, id);
      if (!current) throw notFound('Department');
      if (current.employeeCount > 0) {
        throw new ApiError(409, 'DEPARTMENT_HAS_EMPLOYEES', `${current.name} still has employees assigned to it`);
      }
      await tx.remove(p.tenantId, id);
      await this.audit(tx, p, 'department.removed', id, { name: current.name });
    });
  }

  private audit(tx: DepartmentsTx, p: Principal, action: string, entityId: string, detail: Record<string, unknown>) {
    return tx.audit({ tenantId: p.tenantId, actorId: p.userId, action, entityType: 'department', entityId, detail });
  }
}

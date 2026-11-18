import type { ExecutionContext } from '@nestjs/common';
import { HrGuard } from './hr.guard';
import { HeaderPrincipalResolver } from './header-principal.resolver';
import type { Principal, PrincipalResolver } from './principal';

function ctx(req: Record<string, unknown> = {}) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function guardFor(principal: Principal | null) {
  const resolver: PrincipalResolver = { resolve: async () => principal };
  return new HrGuard(resolver);
}

const base = { userId: 'u1', tenantId: 't1' };

describe('HrGuard', () => {
  it('lets an HR principal through and attaches it to the request', async () => {
    const req: Record<string, unknown> = {};
    await expect(guardFor({ ...base, roles: ['hr'] }).canActivate(ctx(req))).resolves.toBe(true);
    expect(req.principal).toMatchObject({ userId: 'u1' });
  });

  it('refuses a signed-in user who is not HR with 403', async () => {
    await expect(guardFor({ ...base, roles: ['employee'] }).canActivate(ctx())).rejects.toMatchObject({ status: 403 });
  });

  it('refuses a request with no principal with 401', async () => {
    await expect(guardFor(null).canActivate(ctx())).rejects.toMatchObject({ status: 401 });
  });
});

describe('HeaderPrincipalResolver', () => {
  const resolver = new HeaderPrincipalResolver();

  it('reads user, tenant and roles from the headers', async () => {
    const headers = { 'x-user-id': 'u1', 'x-tenant-id': 't1', 'x-roles': 'hr, employee' };
    expect(await resolver.resolve({ headers })).toEqual({ userId: 'u1', tenantId: 't1', roles: ['hr', 'employee'] });
  });

  it('returns null when user or tenant is missing', async () => {
    expect(await resolver.resolve({ headers: { 'x-roles': 'hr' } })).toBeNull();
  });
});

import { Injectable } from '@nestjs/common';
import type { Principal, PrincipalRequest, PrincipalResolver } from './principal';

function header(req: PrincipalRequest, name: string): string {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/** Development-only resolver; AuthModule registers it only when AUTH_DEV_HEADERS=true. */
@Injectable()
export class HeaderPrincipalResolver implements PrincipalResolver {
  async resolve(req: PrincipalRequest): Promise<Principal | null> {
    const userId = header(req, 'x-user-id');
    const tenantId = header(req, 'x-tenant-id');
    if (!userId || !tenantId) return null;
    const roles = header(req, 'x-roles')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    return { userId, tenantId, roles };
  }
}

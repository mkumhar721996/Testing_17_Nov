import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export type Principal = { userId: string; tenantId: string; roles: string[] };

export type PrincipalRequest = { headers: Record<string, string | string[] | undefined> };

/** Port: maps a request to the signed-in user, or null when there is none (ADR-0005). */
export interface PrincipalResolver {
  resolve(req: PrincipalRequest): Promise<Principal | null>;
}

export const PRINCIPAL_RESOLVER = Symbol('PRINCIPAL_RESOLVER');

export const HR_ROLE = 'hr';

export const CurrentPrincipal = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal => {
  return ctx.switchToHttp().getRequest().principal;
});

import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { HR_ROLE, PRINCIPAL_RESOLVER, type PrincipalResolver } from './principal';

/** Admits only signed-in HR users and attaches the principal to the request. */
@Injectable()
export class HrGuard implements CanActivate {
  constructor(@Inject(PRINCIPAL_RESOLVER) private readonly resolver: PrincipalResolver) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const principal = await this.resolver.resolve(req);
    if (!principal) throw new UnauthorizedException();
    if (!principal.roles.includes(HR_ROLE)) throw new ForbiddenException();
    req.principal = principal;
    return true;
  }
}

/** Admits any signed-in user and attaches the principal to the request. */
@Injectable()
export class SignedInGuard implements CanActivate {
  constructor(@Inject(PRINCIPAL_RESOLVER) private readonly resolver: PrincipalResolver) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const principal = await this.resolver.resolve(req);
    if (!principal) throw new UnauthorizedException();
    req.principal = principal;
    return true;
  }
}

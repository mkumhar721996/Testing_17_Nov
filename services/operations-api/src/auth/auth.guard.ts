import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CurrentUser } from './current-user.decorator';

export interface TokenVerifier {
  verify(token: string): Promise<CurrentUser | null>;
}

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: unknown = request.headers?.authorization;
    const match = typeof header === 'string' ? /^Bearer (.+)$/.exec(header) : null;
    const user = match ? await this.verifier.verify(match[1]) : null;
    if (!user) throw new UnauthorizedException();
    request.user = { userId: user.userId, tenantId: user.tenantId };
    return true;
  }
}

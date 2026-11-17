import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TOKEN_VERIFIER, type TokenVerifier } from './token-verifier';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException();
    try {
      await this.verifier.verify(match[1]);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}

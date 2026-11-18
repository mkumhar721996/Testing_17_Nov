import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, TokenVerifier } from './auth.guard';

const ctx = (authorization?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: authorization ? { authorization } : {} }) }),
  }) as unknown as ExecutionContext;

const verifier: TokenVerifier = {
  verify: async (token) => {
    if (token === 'good') return { sub: 'u1' };
    throw new Error('bad token');
  },
};

describe('AuthGuard', () => {
  const guard = new AuthGuard(verifier);

  it('rejects a missing header (AC11)', async () => {
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each(['Basic x', 'Bearer ', 'Bearer', 'Bearer bad', 'Bearer a b'])('rejects %j (AC11)', async (h) => {
    await expect(guard.canActivate(ctx(h))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a verified token', async () => {
    await expect(guard.canActivate(ctx('Bearer good'))).resolves.toBe(true);
  });
});

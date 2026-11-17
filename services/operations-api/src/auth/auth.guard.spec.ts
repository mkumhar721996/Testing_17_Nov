import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from './auth.guard';
import type { TokenVerifier } from './token-verifier';

const ctx = (headers: Record<string, string>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

const verifier: TokenVerifier = {
  verify: async (token) => {
    if (token !== 'good') throw new Error('invalid');
    return { sub: 'user-a' };
  },
};

describe('AuthGuard', () => {
  const guard = new AuthGuard(verifier);

  it('rejects a missing header', async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects a non-Bearer header', async () => {
    await expect(guard.canActivate(ctx({ authorization: 'Basic abc' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it('rejects a token the verifier rejects', async () => {
    await expect(guard.canActivate(ctx({ authorization: 'Bearer bad' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it('accepts a valid token', async () => {
    await expect(guard.canActivate(ctx({ authorization: 'Bearer good' }))).resolves.toBe(true);
  });
});

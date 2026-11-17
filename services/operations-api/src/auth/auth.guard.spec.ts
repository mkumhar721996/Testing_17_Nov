import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from './auth.guard';
import { TokenVerifier } from './token-verifier';

const verifier: TokenVerifier = {
  async verify(token) {
    if (token !== 'good') throw new Error('bad token');
    return { sub: 'u1', tenantId: 't1' };
  },
};

function context(headers: Record<string, string | undefined>) {
  const request: Record<string, unknown> = { headers };
  const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
  return { ctx, request };
}

describe('AuthGuard', () => {
  const guard = new AuthGuard(verifier);

  it('sets the caller from a valid bearer token', async () => {
    const { ctx, request } = context({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.caller).toEqual({ sub: 'u1', tenantId: 't1' });
  });

  it.each([{}, { authorization: 'Basic abc' }, { authorization: 'Bearer bad' }])(
    'rejects %j with 401',
    async (headers) => {
      await expect(guard.canActivate(context(headers).ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );
});

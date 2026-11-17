import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthGuard, type TokenVerifier } from './auth.guard';

const verifier: TokenVerifier = {
  verify: async (token) => (token === 'good' ? { userId: 'u1', tenantId: 't1' } : null),
};

function contextFor(request: object) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  it('attaches the verified user to the request', async () => {
    const request: { headers: object; user?: unknown } = {
      headers: { authorization: 'Bearer good' },
    };
    await expect(new AuthGuard(verifier).canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'u1', tenantId: 't1' });
  });

  it.each([{}, { authorization: 'Bearer bad' }, { authorization: 'Basic good' }])(
    'rejects %j with 401',
    async (headers) => {
      await expect(
        new AuthGuard(verifier).canActivate(contextFor({ headers })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
});

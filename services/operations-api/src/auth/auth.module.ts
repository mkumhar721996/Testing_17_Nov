import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CognitoTokenVerifier } from './cognito-token-verifier';
import { TOKEN_VERIFIER, TokenVerifier } from './token-verifier';

/** E2E-only: "<sub>:<tenant>" bearer tokens, honoured when E2E_FAKE_AUTH=1 outside production. */
class FakeTokenVerifier implements TokenVerifier {
  async verify(token: string) {
    const [sub, tenantId] = token.split(':');
    if (!sub || !tenantId) throw new Error('Malformed test token');
    return { sub, tenantId };
  }
}

@Global()
@Module({
  providers: [
    {
      provide: TOKEN_VERIFIER,
      useFactory: (): TokenVerifier =>
        process.env.E2E_FAKE_AUTH === '1' && process.env.NODE_ENV !== 'production'
          ? new FakeTokenVerifier()
          : new CognitoTokenVerifier(),
    },
    AuthGuard,
  ],
  exports: [TOKEN_VERIFIER, AuthGuard],
})
export class AuthModule {}

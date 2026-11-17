import { Global, Module } from '@nestjs/common';
import { AuthGuard, TOKEN_VERIFIER, type TokenVerifier } from './auth.guard';

// The Cognito-backed verifier is a separate story (ADR-0005); until it is bound,
// every token is rejected.
const rejectAllVerifier: TokenVerifier = { verify: async () => null };

@Global()
@Module({
  providers: [{ provide: TOKEN_VERIFIER, useValue: rejectAllVerifier }, AuthGuard],
  exports: [TOKEN_VERIFIER, AuthGuard],
})
export class AuthModule {}

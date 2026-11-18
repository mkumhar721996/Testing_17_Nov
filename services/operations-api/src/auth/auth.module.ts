import { Module } from '@nestjs/common';
import { AuthGuard, TOKEN_VERIFIER } from './auth.guard';
import { CognitoTokenVerifier } from './cognito-token.verifier';

@Module({
  providers: [{ provide: TOKEN_VERIFIER, useClass: CognitoTokenVerifier }, AuthGuard],
  exports: [TOKEN_VERIFIER, AuthGuard],
})
export class AuthModule {}

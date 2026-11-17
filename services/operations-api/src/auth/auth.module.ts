import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CognitoTokenVerifier } from './cognito-token-verifier';
import { TOKEN_VERIFIER } from './token-verifier';

@Module({
  providers: [{ provide: TOKEN_VERIFIER, useFactory: () => new CognitoTokenVerifier() }, AuthGuard],
  exports: [TOKEN_VERIFIER, AuthGuard],
})
export class AuthModule {}

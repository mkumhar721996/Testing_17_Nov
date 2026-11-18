import { Injectable } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { TokenVerifier } from './auth.guard';

/**
 * Validates Amazon Cognito access tokens (ADR-0005).
 *
 * Settings (both required for any signed-in call):
 * - COGNITO_USER_POOL_ID: the Cognito user pool id
 * - COGNITO_CLIENT_ID: the app client id
 * When either is unset every token is rejected, so the API answers 401 (fails closed).
 */
@Injectable()
export class CognitoTokenVerifier implements TokenVerifier {
  private readonly verifier?: { verify(token: string): Promise<{ sub: string }> };

  constructor() {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;
    if (userPoolId && clientId) {
      this.verifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId });
    }
  }

  async verify(token: string): Promise<{ sub: string }> {
    if (!this.verifier) throw new Error('Cognito is not configured');
    return this.verifier.verify(token);
  }
}

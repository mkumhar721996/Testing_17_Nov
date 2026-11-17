import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { TokenVerifier } from './token-verifier';

/** Fails closed: without a configured user pool every token is rejected. */
export class CognitoTokenVerifier implements TokenVerifier {
  private readonly jwt?: {
    verify(token: string): Promise<{ sub: string; [claim: string]: unknown }>;
  };

  constructor(userPoolId = process.env.COGNITO_USER_POOL_ID, clientId = process.env.COGNITO_CLIENT_ID) {
    if (userPoolId && clientId) {
      this.jwt = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });
    }
  }

  async verify(token: string) {
    if (!this.jwt) throw new Error('Cognito is not configured');
    const payload = await this.jwt.verify(token);
    const tenantId = payload['custom:tenant_id'];
    if (typeof tenantId !== 'string' || !tenantId) throw new Error('Token has no tenant');
    return { sub: payload.sub, tenantId };
  }
}

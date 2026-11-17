import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto';
import type { TokenVerifier } from './token-verifier';

type Jwks = { keys: (JsonWebKey & { kid?: string })[] };

export interface CognitoVerifierOptions {
  userPoolId?: string;
  clientId?: string;
  fetchJwks?: (url: string) => Promise<Jwks>;
}

const fetchJson = async (url: string): Promise<Jwks> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JWKS request failed: ${res.status}`);
  return (await res.json()) as Jwks;
};

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

/**
 * Verifies Amazon Cognito access and ID tokens (RS256) using only Node built-ins.
 * Fails closed: with no pool or client configured, every token is rejected.
 */
export class CognitoTokenVerifier implements TokenVerifier {
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly fetchJwks: (url: string) => Promise<Jwks>;
  private jwks?: Promise<Jwks>;

  constructor(options: CognitoVerifierOptions = {}) {
    this.userPoolId = options.userPoolId ?? process.env.COGNITO_USER_POOL_ID ?? '';
    this.clientId = options.clientId ?? process.env.COGNITO_CLIENT_ID ?? '';
    this.fetchJwks = options.fetchJwks ?? fetchJson;
  }

  async verify(token: string): Promise<{ sub: string }> {
    if (!this.userPoolId || !this.clientId) throw new Error('Cognito is not configured');
    const region = this.userPoolId.split('_')[0];
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${this.userPoolId}`;

    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');
    const [head, body, sig] = parts;
    const header = decode(head);
    if (header.alg !== 'RS256') throw new Error('Unsupported algorithm');

    const key = (await this.loadJwks(issuer)).keys.find((k) => k.kid === header.kid);
    if (!key) throw new Error('Unknown signing key');
    const valid = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${head}.${body}`),
      createPublicKey({ key, format: 'jwk' }),
      Buffer.from(sig, 'base64url'),
    );
    if (!valid) throw new Error('Invalid signature');

    const claims = decode(body);
    if (claims.iss !== issuer) throw new Error('Wrong issuer');
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
      throw new Error('Token expired');
    }
    const audience =
      claims.token_use === 'access' ? claims.client_id : claims.token_use === 'id' ? claims.aud : null;
    if (audience !== this.clientId) throw new Error('Wrong client');
    if (typeof claims.sub !== 'string') throw new Error('Missing subject');
    return { sub: claims.sub };
  }

  private loadJwks(issuer: string): Promise<Jwks> {
    if (!this.jwks) {
      this.jwks = this.fetchJwks(`${issuer}/.well-known/jwks.json`).catch((err) => {
        this.jwks = undefined;
        throw err;
      });
    }
    return this.jwks;
  }
}

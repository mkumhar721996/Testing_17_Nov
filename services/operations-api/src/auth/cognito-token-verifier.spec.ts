import { createSign, generateKeyPairSync, type JsonWebKey } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { CognitoTokenVerifier } from './cognito-token-verifier';

const POOL = 'ap-south-1_testpool';
const CLIENT = 'test-client';
const ISS = `https://cognito-idp.ap-south-1.amazonaws.com/${POOL}`;
const KID = 'key-1';

const b64 = (v: object | Buffer) =>
  Buffer.from(v instanceof Buffer ? v : JSON.stringify(v)).toString('base64url');

let privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
let jwks: { keys: JsonWebKey[] };

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = pair.privateKey;
  jwks = { keys: [{ ...pair.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256' }] };
});

const now = () => Math.floor(Date.now() / 1000);

function signed(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const head = b64({ alg: 'RS256', kid: KID, ...header });
  const body = b64({
    sub: 'u1',
    iss: ISS,
    token_use: 'access',
    client_id: CLIENT,
    exp: now() + 600,
    ...claims,
  });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64(sig)}`;
}

const make = (config: { userPoolId?: string; clientId?: string } = {}) =>
  new CognitoTokenVerifier({
    userPoolId: POOL,
    clientId: CLIENT,
    fetchJwks: async () => jwks,
    ...config,
  });

describe('CognitoTokenVerifier', () => {
  it('accepts a valid access token and returns its sub', async () => {
    await expect(make().verify(signed())).resolves.toEqual({ sub: 'u1' });
  });
  it('accepts a valid id token (aud)', async () => {
    const token = signed({ token_use: 'id', aud: CLIENT, client_id: undefined });
    await expect(make().verify(token)).resolves.toEqual({ sub: 'u1' });
  });
  it('rejects a tampered signature', async () => {
    const [h, , s] = signed().split('.');
    const forged = `${h}.${b64({ sub: 'evil', iss: ISS, token_use: 'access', client_id: CLIENT, exp: now() + 600 })}.${s}`;
    await expect(make().verify(forged)).rejects.toThrow();
  });
  it('rejects an expired token', async () => {
    await expect(make().verify(signed({ exp: now() - 10 }))).rejects.toThrow();
  });
  it('rejects a wrong issuer', async () => {
    await expect(make().verify(signed({ iss: 'https://evil.example/pool' }))).rejects.toThrow();
  });
  it('rejects a wrong client', async () => {
    await expect(make().verify(signed({ client_id: 'other' }))).rejects.toThrow();
  });
  it('rejects an unexpected token_use', async () => {
    await expect(make().verify(signed({ token_use: 'refresh' }))).rejects.toThrow();
  });
  it('rejects alg none', async () => {
    const token = `${b64({ alg: 'none' })}.${b64({ sub: 'u1', iss: ISS, token_use: 'access', client_id: CLIENT, exp: now() + 600 })}.`;
    await expect(make().verify(token)).rejects.toThrow();
  });
  it('rejects an unknown key id', async () => {
    await expect(make().verify(signed({}, { kid: 'other' }))).rejects.toThrow();
  });
  it('rejects malformed tokens', async () => {
    await expect(make().verify('not-a-jwt')).rejects.toThrow();
  });
  it('fails closed when configuration is unset', async () => {
    await expect(make({ userPoolId: '' }).verify(signed())).rejects.toThrow();
    await expect(make({ clientId: '' }).verify(signed())).rejects.toThrow();
  });
});

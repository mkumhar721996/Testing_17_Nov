export interface TokenVerifier {
  verify(token: string): Promise<{ sub: string }>;
}

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

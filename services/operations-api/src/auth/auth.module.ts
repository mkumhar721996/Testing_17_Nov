import { Global, Logger, Module } from '@nestjs/common';
import { HeaderPrincipalResolver } from './header-principal.resolver';
import { HrGuard, SignedInGuard } from './hr.guard';
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from './principal';

// Until the identity story supplies token validation, nobody is signed in unless the
// development header resolver is switched on.
const noPrincipal: PrincipalResolver = { resolve: async () => null };

/** The header resolver trusts client-supplied identity, so it must never run in production. */
export function createPrincipalResolver(
  env: Record<string, string | undefined>,
  warn: (message: string) => void = (m) => new Logger('AuthModule').warn(m),
): PrincipalResolver {
  if (env.AUTH_DEV_HEADERS !== 'true') return noPrincipal;
  if (env.NODE_ENV === 'production') {
    throw new Error('AUTH_DEV_HEADERS=true is not allowed when NODE_ENV is production.');
  }
  warn('AUTH_DEV_HEADERS is on: any caller can claim any user, tenant and role. Development only.');
  return new HeaderPrincipalResolver();
}

@Global()
@Module({
  providers: [
    {
      provide: PRINCIPAL_RESOLVER,
      useFactory: (): PrincipalResolver => createPrincipalResolver(process.env),
    },
    HrGuard,
    SignedInGuard,
  ],
  exports: [PRINCIPAL_RESOLVER, HrGuard, SignedInGuard],
})
export class AuthModule {}

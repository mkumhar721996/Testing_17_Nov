import { Global, Module } from '@nestjs/common';
import { HeaderPrincipalResolver } from './header-principal.resolver';
import { HrGuard, SignedInGuard } from './hr.guard';
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from './principal';

// Until the identity story supplies token validation, nobody is signed in unless the
// development header resolver is switched on.
const noPrincipal: PrincipalResolver = { resolve: async () => null };

@Global()
@Module({
  providers: [
    {
      provide: PRINCIPAL_RESOLVER,
      useFactory: (): PrincipalResolver =>
        process.env.AUTH_DEV_HEADERS === 'true' ? new HeaderPrincipalResolver() : noPrincipal,
    },
    HrGuard,
    SignedInGuard,
  ],
  exports: [PRINCIPAL_RESOLVER, HrGuard, SignedInGuard],
})
export class AuthModule {}

import { describe, expect, it, vi } from 'vitest';
import { HeaderPrincipalResolver } from './header-principal.resolver';
import { createPrincipalResolver } from './auth.module';

describe('createPrincipalResolver', () => {
  it('resolves nobody when the dev header switch is off', async () => {
    const resolver = createPrincipalResolver({});
    await expect(resolver.resolve({ headers: { 'x-user-id': 'u', 'x-tenant-id': 't', 'x-roles': 'hr' } })).resolves.toBeNull();
  });

  it('uses the header resolver and warns when the switch is on outside production', () => {
    const warn = vi.fn();
    const resolver = createPrincipalResolver({ AUTH_DEV_HEADERS: 'true', NODE_ENV: 'development' }, warn);
    expect(resolver).toBeInstanceOf(HeaderPrincipalResolver);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('AUTH_DEV_HEADERS'));
  });

  it('refuses to start with the dev header switch on in production', () => {
    expect(() => createPrincipalResolver({ AUTH_DEV_HEADERS: 'true', NODE_ENV: 'production' })).toThrow(/production/);
  });

  it('allows production when the switch is off', () => {
    expect(() => createPrincipalResolver({ NODE_ENV: 'production' })).not.toThrow();
  });
});

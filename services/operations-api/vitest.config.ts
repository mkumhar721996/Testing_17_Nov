import { defineConfig } from 'vitest/config';

// esbuild transpiles the tests: it supports experimentalDecorators but does not emit
// decorator metadata, so providers must use explicit @Inject(...) in constructors.
export default defineConfig({
  esbuild: {
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});

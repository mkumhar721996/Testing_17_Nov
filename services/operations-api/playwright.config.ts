import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './test/e2e',
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    // Migrations run first when a database is configured; the data specs need one.
    command: 'pnpm run build && ([ -z "$DATABASE_URL" ] || node dist/database/migrate) && node dist/main',
    url: `http://127.0.0.1:${port}/health`,
    env: { HOST: '127.0.0.1', PORT: String(port), AUTH_DEV_HEADERS: 'true' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

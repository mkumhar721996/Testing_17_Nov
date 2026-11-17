import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './test/e2e',
  // Serial: the menu specs share one seeded database.
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    // Migrations run only when a database is configured, so the health spec still runs without one.
    command:
      'pnpm run build && { [ -z "$DATABASE_URL" ] || node dist/database/migrate.js; } && node dist/main',
    url: `http://127.0.0.1:${port}/health`,
    env: {
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      E2E_FAKE_AUTH: '1',
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

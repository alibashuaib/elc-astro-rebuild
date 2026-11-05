import { defineConfig } from '@playwright/test';

// Phase 8 live smoke: with SMOKE_BASE_URL set, no local servers and no local D1 writes.
const external = !!process.env.SMOKE_BASE_URL;

// Smoke tests only: load the real built site against a real Worker and prove
// the page works in a browser. The build and the unit suites cannot see
// runtime faults inside Astro client scripts -- a ReferenceError in
// TestRunner shipped to main once with CI green.
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: external ? undefined : './tests/e2e/global-setup.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost:4322',
    trace: 'retain-on-failure',
  },
  webServer: external
    ? undefined
    : {
        command: 'npm run db:migrate:local --prefix placement-test-worker && npm run dev --prefix placement-test-worker',
        url: 'http://localhost:8787/api/slots',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

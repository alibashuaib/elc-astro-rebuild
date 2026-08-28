import { defineConfig } from '@playwright/test';

// Smoke tests only: load the real built site against a real Worker and prove
// the page works in a browser. The build and the unit suites cannot see
// runtime faults inside Astro client scripts -- a ReferenceError in
// TestRunner shipped to main once with CI green.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
});

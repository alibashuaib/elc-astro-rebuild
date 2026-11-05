import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
      return {
        wrangler: { configPath: './wrangler.toml' },
        // Explicit test bindings: tests never depend on a developer's .dev.vars.
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, ADMIN_COOKIE_SECRET: 'test-secret' } },
      };
    }),
  ],
  test: { setupFiles: ['./test/apply-migrations.ts'] },
});

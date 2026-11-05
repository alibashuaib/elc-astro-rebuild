import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeEach } from 'vitest';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Real D1 keeps rows between tests in a file. Empty every table except the seeded
// question bank (and migration bookkeeping) so each test starts clean. The table list
// is read at run time so tables added by later migrations are covered.
const KEEP = ['questions', 'passages', 'd1_migrations'];
beforeEach(async () => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
  ).all<{ name: string }>();
  const tables = results.map((r) => r.name).filter((n) => !KEEP.includes(n));
  await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = true'),
    ...tables.map((t) => env.DB.prepare(`DELETE FROM "${t}"`)),
  ]);
});

import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';

it('replays every migration file on the empty test D1', async () => {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM d1_migrations').first<{ n: number }>();
  expect(env.TEST_MIGRATIONS.length).toBeGreaterThanOrEqual(21);
  expect(row?.n).toBe(env.TEST_MIGRATIONS.length);
});

// The name is kept so existing tests (and feature/registration-wizard's) import it unchanged.
// It returns the real local D1 that @cloudflare/vitest-plugin provides inside workerd.
// workerd runs on this machine; the "Workers runtime crashed ... (crash #1)" startup line
// from `wrangler dev` is expected and not a failure.
import { env } from 'cloudflare:workers';

export function createFakeD1(): D1Database {
  return env.DB;
}

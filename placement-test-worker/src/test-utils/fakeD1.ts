// In-memory D1Database-compatible shim, backed by better-sqlite3.
//
// Why this exists: @cloudflare/vitest-pool-workers and `wrangler dev --local`
// both start the real `workerd` native runtime, which crashes on startup in
// this sandboxed environment ("The Workers runtime crashed unexpectedly and
// is being restarted" on every attempt — confirmed via direct
// `wrangler dev` / `wrangler d1 execute --local` runs). This shim lets
// Worker route/db code be unit-tested without workerd. It implements only
// the subset of the D1Database surface this project's code actually calls:
// prepare().bind(...).run()/.first()/.all(), and db.exec(sql).
//
// Production code never imports this file — Env.DB stays typed as the real
// D1Database everywhere outside tests. Swap this out for real
// `@cloudflare/vitest-pool-workers` if the CI/dev environment gets a working
// workerd (e.g. running outside this sandbox).

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

export function createFakeD1(migrationFiles: string[]): D1Database {
  const db = new Database(':memory:');
  for (const file of migrationFiles) {
    db.exec(readFileSync(file, 'utf8'));
  }

  function wrapStatement(sql: string) {
    const stmt = db.prepare(sql);
    return {
      bind(...args: unknown[]) {
        const bound = stmt.bind(...(args as any[]));
        return {
          async run() {
            const isSelect = /^\s*select/i.test(sql);
            if (isSelect) {
              const results = bound.all();
              return { results, meta: { changes: 0, last_row_id: 0 } };
            }
            const info = bound.run();
            return { meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
          },
          async first<T = unknown>(): Promise<T | null> {
            return (bound.get() as T) ?? null;
          },
          async all<T = unknown>(): Promise<{ results: T[] }> {
            return { results: bound.all() as T[] };
          },
        };
      },
    };
  }

  return {
    prepare(sql: string) {
      return wrapStatement(sql);
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 0, duration: 0 } as any;
    },
  } as unknown as D1Database;
}

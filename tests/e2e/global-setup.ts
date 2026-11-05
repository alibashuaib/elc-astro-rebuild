import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { preview } from 'astro';

export default async function globalSetup() {
  const root = process.cwd();
  const worker = path.join(root, 'placement-test-worker');

  // Build the site against the local Worker (same as CI did by hand).
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PUBLIC_PLACEMENT_API_URL: 'http://localhost:8787' },
  });

  // Own future slot: never depends on a hard-coded date. Local D1 only.
  const sql = [
    "DELETE FROM bookings WHERE slot_id = 'e2e-slot'",
    "DELETE FROM slots WHERE id = 'e2e-slot'",
    "INSERT INTO slots (id, starts_at, capacity, booked_count) VALUES ('e2e-slot', strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days'), 5, 0)",
  ].join(';');
  execFileSync(
    process.execPath,
    [path.join(worker, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'd1', 'execute', 'placement-test', '--local', '--command', sql],
    { cwd: worker, stdio: 'inherit' },
  );

  // In-process on purpose: the `astro preview` CLI leaves a detached child bound to the port on Windows.
  const server = await preview({ root, server: { port: 4322 } });
  return () => server.stop();
}

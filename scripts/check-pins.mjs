// Fails when any package.json dependency is not an exact version (^, ~, latest, ranges).
// Paths are relative to the cwd (npm runs scripts from the package root).
// cms-oauth-worker is skipped until it has a package.json.
import { readFileSync, existsSync } from 'node:fs';

const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
let bad = 0;
for (const dir of ['.', 'placement-test-worker', 'cms-oauth-worker']) {
  const file = `${dir}/package.json`;
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, range] of Object.entries(pkg[section] ?? {})) {
      if (!EXACT.test(range)) {
        console.error(`${file}: ${section}.${name} = "${range}" is not an exact version`);
        bad++;
      }
    }
  }
}
process.exit(bad ? 1 : 0);

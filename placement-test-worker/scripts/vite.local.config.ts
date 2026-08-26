import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  build: {
    ssr: path.join(workerRoot, 'scripts', 'local-dev.ts'),
    outDir: path.join(workerRoot, '.local-dev'),
    emptyOutDir: true,
    target: 'node24',
    rollupOptions: {
      output: { entryFileNames: 'server.mjs' },
    },
  },
});

// vitest/config re-exports Vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config';
import { transformWithEsbuild, type Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Resolved relative to the Vite root rather than with node:path, so this config needs no @types/node
// and `src` stays free of Node globals.
const fromRoot = (path: string): string => new URL(path, import.meta.url).pathname;

/**
 * Serve the Service Worker in dev.
 *
 * `vite build` emits src/sw.ts to /sw.js, but nothing does that under `vite dev` — the request hits
 * the SPA fallback and comes back as index.html. Registration then rejects on the HTML MIME type,
 * so `subscribeToPush` bails before it ever POSTs /push/subscribe and no push can arrive locally.
 *
 * sw.ts imports nothing, so a single-file transform is enough; there is no bundling to do. It does
 * carry a bare `export {}` — the marker that makes it a TS module so it can redeclare `self` — and
 * esbuild preserves it. `vite build` drops it through rollup, but here it would make the output an
 * ES module, which a classic worker registration cannot evaluate. Registering as a module worker
 * would be the alternative; Firefox does not support that yet, so strip the marker instead.
 */
const MODULE_MARKER = /^\s*export\s*\{\s*\}\s*;?\s*$/gm;

const devServiceWorker = (): Plugin => ({
  name: 'bestrx:dev-service-worker',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/sw.js', async (_req, res, next) => {
      try {
        const source = await readFile(fromRoot('src/sw.ts'), 'utf8');
        const { code } = await transformWithEsbuild(source, 'sw.ts', { loader: 'ts' });

        res.setHeader('Content-Type', 'text/javascript');
        // A worker may only control pages at or below its own path unless this widens the scope.
        res.setHeader('Service-Worker-Allowed', '/');
        // The worker changes as often as the source does; a cached copy hides edits behind a
        // registration that never updates.
        res.setHeader('Cache-Control', 'no-cache');
        res.end(code.replace(MODULE_MARKER, ''));
      } catch (error) {
        next(error);
      }
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), devServiceWorker()],
    resolve: {
      // `@` -> src. Mirrors the paths entry in tsconfig.json.
      alias: { '@': fromRoot('src') },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Docker bind mounts don't emit inotify events reliably on macOS.
      watch: { usePolling: true },
    },
    build: {
      rollupOptions: {
        input: {
          main: fromRoot('index.html'),
          // The service worker is TypeScript (CLAUDE.md bans hand-written .js), so it is built
          // rather than dropped into public/. It must land at the site root: a worker can only
          // control pages at or below its own path.
          sw: fromRoot('src/sw.ts'),
        },
        output: {
          entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      // The store is empty until the API loads it; seed it from the JSON fixtures for every test.
      setupFiles: [fromRoot('src/test-setup.ts')],
    },
  };
});

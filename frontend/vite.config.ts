// vitest/config re-exports Vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Resolved relative to the Vite root rather than with node:path, so this config needs no @types/node
// and `src` stays free of Node globals.
const fromRoot = (path: string): string => new URL(path, import.meta.url).pathname;

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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

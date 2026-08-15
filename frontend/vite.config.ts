// vitest/config re-exports Vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Resolved relative to the Vite root rather than with node:path, so this config needs no @types/node
// and `src` stays free of Node globals.
const fromRoot = (path: string): string => new URL(path, import.meta.url).pathname;

export default defineConfig(({ mode }) => {
  // ANTHROPIC_API_KEY lives in frontend/.env (git-ignored) and is read here, server-side.
  // It is deliberately NOT VITE_-prefixed, so it never reaches the browser bundle — the
  // dev server proxies /api/anthropic/* to Anthropic and injects the key on the way out.
  const env = loadEnv(mode, new URL('.', import.meta.url).pathname, '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Docker bind mounts don't emit inotify events reliably on macOS.
      watch: { usePolling: true },
      proxy: {
        // Narrow on purpose: only the Messages endpoint is forwarded, so this can't be
        // used as a general Anthropic proxy. Compose publishes the port on loopback only,
        // and Vite's default dev CORS policy already rejects non-localhost origins.
        '/api/anthropic/v1/messages': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          headers: env.ANTHROPIC_API_KEY ? { 'x-api-key': env.ANTHROPIC_API_KEY } : {},
        },
      },
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

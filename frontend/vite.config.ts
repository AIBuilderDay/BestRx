// vitest/config re-exports Vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          headers: env.ANTHROPIC_API_KEY ? { 'x-api-key': env.ANTHROPIC_API_KEY } : {},
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  };
});

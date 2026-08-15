/**
 * The dev server has to serve the Service Worker, not the SPA fallback.
 *
 * `vite build` emits src/sw.ts to /sw.js, but that output does not exist under `vite dev` — the
 * request falls through to index.html, registration rejects on the HTML MIME type, and push
 * subscription silently never happens. This test is the guard against that regression.
 */

import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    // The repo's vite.config.ts is picked up from the frontend root; only the port is overridden so
    // the test never collides with a running `task start`.
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();

  const address = server.httpServer?.address();
  if (typeof address === 'string' || !address) throw new Error('dev server did not bind a port');
  origin = `http://127.0.0.1:${address.port}`;
}, 30_000);

afterAll(async () => {
  await server?.close();
});

it('serves /sw.js as JavaScript rather than the SPA fallback', async () => {
  const response = await fetch(`${origin}/sw.js`);

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/javascript/);

  const body = await response.text();
  expect(body).not.toMatch(/<!doctype html>/i);
  // The push listener is the reason the worker exists; a transform that dropped it is a failure.
  expect(body).toContain("addEventListener(\"push\"");
});

it('serves a classic script, not an ES module', async () => {
  const response = await fetch(`${origin}/sw.js`);
  const body = await response.text();

  // sw.ts carries a bare `export {}` so TypeScript treats it as a module. Left in the served
  // output it makes the file an ES module, and a classic worker registration fails to evaluate it
  // with "ServiceWorker script evaluation failed".
  expect(body).not.toMatch(/^\s*export\b/m);
  expect(body).not.toMatch(/^\s*import\b/m);
});

it('allows the worker to control the whole origin', async () => {
  const response = await fetch(`${origin}/sw.js`);

  // Without this header a worker served from any path may only control that path's subtree.
  expect(response.headers.get('service-worker-allowed')).toBe('/');
});

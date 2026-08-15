/**
 * The one place the app talks to Anthropic.
 *
 * The browser never sees the API key: requests go to the Vite dev server at
 * /api/anthropic, which injects x-api-key server-side (see vite.config.ts).
 * If the key is missing the proxy still forwards the request and Anthropic
 * answers 401 — every caller treats any failure as "fall back to deterministic".
 */

import Anthropic from '@anthropic-ai/sdk';

/** Haiku 4.5 — fast (<1s first token), cheap, no thinking latency. Decided in docs/specs/enhanced-search.md. */
export const AI_MODEL = 'claude-haiku-4-5';

/** USD per 1M tokens, used to price each call for the token ledger. */
export const MODEL_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
};

/** Hard ceiling on how long the nurse waits before we fall back. */
export const AI_TIMEOUT_MS = 15_000;

let client: Anthropic | null = null;

export function getAiClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      // Real key is attached by the dev-server proxy; this placeholder never leaves localhost.
      apiKey: 'key-injected-by-vite-proxy',
      baseURL: `${window.location.origin}/api/anthropic`,
      dangerouslyAllowBrowser: true,
      maxRetries: 1,
      timeout: AI_TIMEOUT_MS,
    });
  }
  return client;
}

export function priceUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICES_PER_MTOK[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

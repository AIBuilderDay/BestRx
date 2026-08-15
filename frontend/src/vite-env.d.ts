/// <reference types="vite/client" />

/**
 * Environment variables the app reads.
 *
 * All optional: with none set, the app serves the JSON fixtures and behaves exactly as it did
 * before a backend existed. See `lib/api.ts`.
 */
interface ImportMetaEnv {
  /** Base URL of the deployed API. Unset means fixtures-only. */
  readonly VITE_API_BASE_URL?: string;
  /** SSE Function URL for live order status. Unset means no live updates. */
  readonly VITE_SSE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

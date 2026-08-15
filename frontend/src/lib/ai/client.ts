/**
 * The AI client. Every model call happens on the backend, at /ai/*.
 *
 * The browser used to call Anthropic directly through the Vite dev server's proxy, which meant AI
 * worked in development and silently did not in production — Cloudflare Pages has no dev server to
 * inject the key. The key now lives on the API, and the agent reaches the catalog through the
 * backend's own MCP tools, so it can only act on rows the store actually returned.
 *
 * Contract with callers: any failure throws, and the caller falls back to plain deterministic
 * search. AI is an enhancement, never a dependency.
 */

import type { AgentOrderResult, AiUsageSummary, AiUsageRecord, RerankResult } from '../../types/ai';
import type { CartDto } from '../api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/** Matches the API's own ceiling, plus headroom for the agent's tool round trips. */
const AI_TIMEOUT_MS = 30_000;

/** Thrown for a 503: the API has no key configured, so AI is off rather than broken. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI is not configured on the API. Showing standard search.');
    this.name = 'AiNotConfiguredError';
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 503) throw new AiNotConfiguredError();
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export interface RerankResponse extends RerankResult {
  /** Display label of the patient the query named, when it named exactly one. */
  patientLabel: string | null;
}

/** Rank these offers for this query. Offer ids only — the API joins the facts itself. */
export const rerankOffers = (
  query: string,
  offerIds: string[],
  hospiceId: string | null,
): Promise<RerankResponse> => post<RerankResponse>('/ai/rerank', { query, offerIds, hospiceId });

/**
 * Fill the user's cart from a plain-English command. The cart is written server-side, so the
 * response carries the authoritative cart rather than an action for the client to apply.
 */
export const runAgentOrder = (command: string, userId: string): Promise<AgentOrderResult> =>
  post<AgentOrderResult>('/ai/order', { command, userId });

export interface UsageResponse {
  records: AiUsageRecord[];
  summary: AiUsageSummary;
}

/** Every AI call the API has made this session, and what it cost. */
export async function fetchAiUsage(): Promise<UsageResponse> {
  const response = await fetch(`${BASE_URL}/ai/usage`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as UsageResponse;
}

export type { CartDto };

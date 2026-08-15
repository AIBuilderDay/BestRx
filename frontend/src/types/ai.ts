/**
 * Types for the AI layer (enhanced search + agent ordering) and its token ledger.
 *
 * These describe what the API's /ai/* endpoints return. The model calls themselves happen on the
 * backend — see backend/app/ai/ — so the ledger below is read from the API rather than kept in
 * this browser. It is the data the cost dashboard reads: every model call is recorded per-feature
 * so spend can be shown split (search re-rank vs agent orders) and as one total.
 * See docs/specs/enhanced-search.md.
 */

import type { CartDto } from '../lib/api';

/** Every AI feature bills into one of these buckets. Add a member when a new surface calls the model. */
export type AiFeature = 'rerank' | 'agent_order' | 'ask';

/** One model call, as the cost dashboard will see it. */
export interface AiUsageRecord {
  id: string;
  /** ISO timestamp of the call. */
  at: string;
  feature: AiFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Computed from the price table at record time, in USD. */
  costUsd: number;
  /** Wall-clock request time in ms — we watch this; the nurse is waiting. */
  latencyMs: number;
  /** False when the call failed and the app fell back to deterministic behavior. */
  ok: boolean;
}

export interface AiUsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Split + grand totals, shaped for the cost dashboard. */
export interface AiUsageSummary {
  byFeature: Record<AiFeature, AiUsageTotals>;
  total: AiUsageTotals;
}

/** The model's answer to "re-rank these offers for this patient/query". */
export interface RerankResult {
  /** Offer ids in best-first order — always a permutation of the input ids. */
  orderedOfferIds: string[];
  /** One short plain-English reason per offer the model chose to explain. */
  reasons: Record<string, string>;
}

/** One tool the agent called on its way to the answer, for the "what it did" trace. */
export interface AgentToolCall {
  tool: string;
  ok: boolean;
}

/** A cart line the agent just added, so the drawer can spotlight it. */
export interface AgentAddedLine {
  offerId: string;
  patientId: string;
}

/**
 * What the agent did with an "order X for Y" command.
 *
 * The cart is written server-side through the same MCP tool an external client would use, so
 * `cart` is the authoritative cart rather than an action for the browser to apply. It is null when
 * the agent could not safely resolve a patient or a product — the caller shows plain search
 * results instead, and never a dead end. A human still confirms checkout.
 */
/** One row an answer cited, resolved server-side into something the UI can link to. */
export interface AskSource {
  kind: 'order' | 'patient' | 'offer';
  id: string;
  /** What to show: an order id and its item, a patient's label, a product name. */
  label: string;
  /** Secondary line — status, diagnosis, vendor. */
  meta: string;
  /** In-app route this row opens. */
  to: string;
}

/**
 * What the ask agent found for a question about orders, patients, or the catalog.
 *
 * Read-only: it answers from the same MCP tools the ordering agent writes through, minus every
 * write. `sources` are only rows a tool actually returned *and* the answer mentions, so a link
 * can never point at something the model invented. `answer` is empty when the model said nothing
 * — the caller falls back to deterministic search rather than showing an empty panel.
 */
export interface AskResult {
  answer: string;
  sources: AskSource[];
  toolCalls: AgentToolCall[];
}

export interface AgentOrderResult {
  /** One sentence the UI can show: what the agent understood. */
  summary: string;
  /** The cart as the server now holds it, or null when nothing was added. */
  cart: CartDto | null;
  /** Every line the cart gained, for the drawer's spotlight. Empty when the cart was not changed. */
  added: AgentAddedLine[];
  toolCalls: AgentToolCall[];
}

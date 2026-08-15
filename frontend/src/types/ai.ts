/**
 * Types for the AI layer (enhanced search + agent ordering) and its token ledger.
 *
 * The ledger is the data the cost dashboard will read later: every model call is
 * recorded per-feature so spend can be shown split (search re-rank vs agent orders)
 * and as one total. See docs/specs/enhanced-search.md.
 */

/** Every AI feature bills into one of these buckets. Add a member when a new surface calls the model. */
export type AiFeature = 'rerank' | 'agent_order';

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

/** The model's parse of an "order X for Y" command. Human confirms before checkout. */
export interface AgentOrderAction {
  offerId: string;
  patientId: string;
  quantity: number;
  /** Model's own confidence; low values are surfaced, not hidden. */
  confidence: 'high' | 'medium' | 'low';
  /** One sentence the UI can show: what the agent understood. */
  summary: string;
}

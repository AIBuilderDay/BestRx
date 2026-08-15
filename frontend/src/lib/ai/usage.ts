/**
 * Token ledger: every AI call is recorded here, split by feature plus a grand
 * total. This is the data the cost dashboard will render later — do not build
 * UI on top of it in this module.
 *
 * Storage is localStorage (same spirit as the JSON mock DB): survives reloads,
 * zero infrastructure, easy to export. Defensive on every read — a corrupt
 * entry must never crash a view.
 */

import type { AiFeature, AiUsageRecord, AiUsageSummary, AiUsageTotals } from '../../types/ai';
import { priceUsd } from './client';

const STORAGE_KEY = 'bestrx.ai_usage.v1';

const EMPTY_TOTALS: AiUsageTotals = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // e.g. storage disabled — the ledger degrades to no-op, the app keeps working
  }
}

export function readUsageLog(): AiUsageRecord[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUsageRecord);
  } catch {
    return [];
  }
}

function isUsageRecord(value: unknown): value is AiUsageRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.at === 'string' &&
    (r.feature === 'rerank' || r.feature === 'agent_order') &&
    typeof r.model === 'string' &&
    typeof r.inputTokens === 'number' &&
    typeof r.outputTokens === 'number' &&
    typeof r.costUsd === 'number' &&
    typeof r.latencyMs === 'number' &&
    typeof r.ok === 'boolean'
  );
}

export interface RecordUsageInput {
  feature: AiFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  ok: boolean;
}

/** Append one call to the ledger. Never throws — cost tracking must not break the feature it tracks. */
export function recordUsage(input: RecordUsageInput): AiUsageRecord {
  const record: AiUsageRecord = {
    id: `AIU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    costUsd: priceUsd(input.model, input.inputTokens, input.outputTokens),
    ...input,
  };
  const store = safeStorage();
  if (store) {
    try {
      const log = readUsageLog();
      log.push(record);
      store.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch {
      // Ledger write failed (quota, private mode) — the call itself still succeeded.
    }
  }
  return record;
}

function addTo(totals: AiUsageTotals, r: AiUsageRecord): AiUsageTotals {
  return {
    calls: totals.calls + 1,
    inputTokens: totals.inputTokens + r.inputTokens,
    outputTokens: totals.outputTokens + r.outputTokens,
    costUsd: totals.costUsd + r.costUsd,
  };
}

/** Per-feature and total spend — the shape the cost dashboard consumes. */
export function summarizeUsage(records: AiUsageRecord[] = readUsageLog()): AiUsageSummary {
  let rerank = EMPTY_TOTALS;
  let agentOrder = EMPTY_TOTALS;
  let total = EMPTY_TOTALS;
  for (const r of records) {
    if (r.feature === 'rerank') rerank = addTo(rerank, r);
    else if (r.feature === 'agent_order') agentOrder = addTo(agentOrder, r);
    total = addTo(total, r);
  }
  return { byFeature: { rerank, agent_order: agentOrder }, total };
}

/** Test/demo helper. */
export function clearUsageLog(): void {
  safeStorage()?.removeItem(STORAGE_KEY);
}

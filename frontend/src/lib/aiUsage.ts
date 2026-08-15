import { getAiUsageForHospice } from '../data/db';
import type { UserRole } from '../types/domain';
import { type CostPeriod } from './costPeriod';
import type { TrendRange } from './trendRange';

export interface AiUsageTotals {
  costUsd: number;
  tokenCount: number;
  requestCount: number;
}

export interface AiUsageTrendPoint {
  label: string;
  value: number;
  tokenCount: number;
  requestCount: number;
  partial: boolean;
}

export const DEFAULT_AI_BUDGET_USD: Partial<Record<UserRole, number>> = {
  director_of_nursing: 75,
  case_manager: 45,
  field_nurse: 35,
  admissions_nurse: 60,
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const dateOf = (iso: string | null | undefined): string | null => {
  if (typeof iso !== 'string' || iso.length < 10) return null;
  const date = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 100) / 10}K`;
  return tokens.toLocaleString();
}

export function aiUsageTotals(
  hospiceId: string,
  period: CostPeriod,
  userIds?: string[],
): AiUsageTotals {
  const visible = userIds === undefined ? null : new Set(userIds);
  const events = getAiUsageForHospice(hospiceId).filter((event) => {
    const date = dateOf(event.occurredAt);
    return (
      date !== null &&
      date >= period.startIso &&
      date < period.endIso &&
      (visible === null || visible.has(event.userId))
    );
  });

  return {
    costUsd: round2(events.reduce((sum, event) => sum + event.costUsd, 0)),
    tokenCount: events.reduce((sum, event) => sum + event.inputTokens + event.outputTokens, 0),
    requestCount: events.length,
  };
}

function newestUsageDate(hospiceId: string, userIds?: string[]): string | null {
  const visible = userIds === undefined ? null : new Set(userIds);
  const dates = getAiUsageForHospice(hospiceId)
    .filter((event) => visible === null || visible.has(event.userId))
    .map((event) => dateOf(event.occurredAt))
    .filter((date): date is string => date !== null);
  return dates.length === 0 ? null : dates.reduce((a, b) => (a > b ? a : b));
}

function summarizeDates(
  hospiceId: string,
  dates: string[],
  userIds?: string[],
): AiUsageTrendPoint[] {
  const visible = userIds === undefined ? null : new Set(userIds);
  const totals = new Map<string, AiUsageTotals>();

  for (const event of getAiUsageForHospice(hospiceId)) {
    const date = dateOf(event.occurredAt);
    if (date === null || !dates.includes(date) || (visible !== null && !visible.has(event.userId))) {
      continue;
    }
    const current = totals.get(date) ?? { costUsd: 0, tokenCount: 0, requestCount: 0 };
    totals.set(date, {
      costUsd: current.costUsd + event.costUsd,
      tokenCount: current.tokenCount + event.inputTokens + event.outputTokens,
      requestCount: current.requestCount + 1,
    });
  }

  return dates.map((date) => {
    const total = totals.get(date) ?? { costUsd: 0, tokenCount: 0, requestCount: 0 };
    return {
      label: WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()],
      value: round2(total.costUsd),
      tokenCount: total.tokenCount,
      requestCount: total.requestCount,
      partial: false,
    };
  });
}

export function aiUsageTrendForRange(
  hospiceId: string,
  period: CostPeriod,
  range: TrendRange,
  userIds?: string[],
): AiUsageTrendPoint[] | null {
  if (range === '1w') {
    const lastUsageDate = newestUsageDate(hospiceId, userIds);
    if (lastUsageDate === null) return [];
    const end = new Date(`${lastUsageDate}T00:00:00Z`);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(end.getTime() - (6 - i) * DAY_MS);
      return d.toISOString().slice(0, 10);
    });
    return summarizeDates(hospiceId, days, userIds);
  }

  if (range !== '1m') return null;

  const visible = userIds === undefined ? null : new Set(userIds);
  const lastUsageDate = newestUsageDate(hospiceId, userIds);
  return period.buckets.map((bucket) => {
    const events = getAiUsageForHospice(hospiceId).filter((event) => {
      const date = dateOf(event.occurredAt);
      return (
        date !== null &&
        date >= bucket.startIso &&
        date < bucket.endIso &&
        (visible === null || visible.has(event.userId))
      );
    });
    return {
      label: bucket.label,
      value: round2(events.reduce((sum, event) => sum + event.costUsd, 0)),
      tokenCount: events.reduce((sum, event) => sum + event.inputTokens + event.outputTokens, 0),
      requestCount: events.length,
      partial: lastUsageDate !== null && bucket.endIso > lastUsageDate,
    };
  });
}

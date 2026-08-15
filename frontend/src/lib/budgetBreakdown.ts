/**
 * Real, non-synthetic breakdowns of who and what is driving DME spend this period — unlike
 * costTrendMock.ts, everything here is derived directly from actual orders.
 *
 * Capped at 4 slices to match the design system's categorical ramp (--s1..--s4; "if a chart needs
 * more than four series, it needs a different chart" — docs/DESIGN_SYSTEM.html). Zero-value entries
 * are dropped rather than shown as an invisible sliver, and any remainder past the top 3 folds into
 * one "Other" slice rather than seating a 4th-and-beyond named category.
 */

import type { AccountBudgetRow } from './budgetLedger';
import type { BasketLine } from './costLedger';

export interface BreakdownSlice {
  key: string;
  label: string;
  valueUsd: number;
}

const MAX_NAMED_SLICES = 3;
const round2 = (n: number): number => Math.round(n * 100) / 100;

function topSlicesWithOther(entries: BreakdownSlice[]): BreakdownSlice[] {
  const sorted = entries.filter((e) => e.valueUsd > 0).sort((a, b) => b.valueUsd - a.valueUsd);
  if (sorted.length <= MAX_NAMED_SLICES + 1) return sorted;

  const top = sorted.slice(0, MAX_NAMED_SLICES);
  const rest = sorted.slice(MAX_NAMED_SLICES);
  const otherUsd = round2(rest.reduce((sum, e) => sum + e.valueUsd, 0));
  return [...top, { key: 'other', label: `Other (${rest.length} codes)`, valueUsd: otherUsd }];
}

/** What exact products are taking up the most budget, by HCPCS code. */
export function productBreakdown(lines: BasketLine[]): BreakdownSlice[] {
  return topSlicesWithOther(
    lines.map((line) => ({ key: line.hcpcs, label: line.name, valueUsd: line.actualUsd })),
  );
}

/** Which accounts are actually spending the money, by who placed the order. */
export function accountBreakdown(rows: AccountBudgetRow[]): BreakdownSlice[] {
  return topSlicesWithOther(
    rows.map((row) => ({ key: row.user.id, label: row.user.name, valueUsd: row.spentUsd })),
  );
}

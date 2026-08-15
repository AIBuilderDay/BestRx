/**
 * Real, non-synthetic breakdowns of who and what is driving DME spend this period — everything
 * here is derived directly from actual orders.
 *
 * Capped at 4 slices to match the design system's categorical ramp (--s1..--s4; "if a chart needs
 * more than four series, it needs a different chart" — docs/DESIGN_SYSTEM.html). Zero-value entries
 * are dropped rather than shown as an invisible sliver, and any remainder past the top 3 folds into
 * one "Other" slice rather than seating a 4th-and-beyond named category.
 */

import type { AccountBudgetRow } from './budgetLedger';
import { getOrdersForHospice } from '../data/db';
import { orderItemExtendedUsd, type BasketLine } from './costLedger';
import { periodContains, type CostPeriod } from './costPeriod';

export interface BreakdownSlice {
  key: string;
  label: string;
  valueUsd: number;
}

const MAX_NAMED_SLICES = 3;
const round2 = (n: number): number => Math.round(n * 100) / 100;

function topSlicesWithOther(entries: BreakdownSlice[], otherNoun: string): BreakdownSlice[] {
  const sorted = entries.filter((e) => e.valueUsd > 0).sort((a, b) => b.valueUsd - a.valueUsd);
  if (sorted.length <= MAX_NAMED_SLICES + 1) return sorted;

  const top = sorted.slice(0, MAX_NAMED_SLICES);
  const rest = sorted.slice(MAX_NAMED_SLICES);
  const otherUsd = round2(rest.reduce((sum, e) => sum + e.valueUsd, 0));
  return [...top, { key: 'other', label: `Other (${rest.length} ${otherNoun})`, valueUsd: otherUsd }];
}

/** What exact products are taking up the most budget, by HCPCS code. */
export function productBreakdown(lines: BasketLine[]): BreakdownSlice[] {
  return topSlicesWithOther(
    lines.map((line) => ({ key: line.hcpcs, label: line.name, valueUsd: line.actualUsd })),
    'codes',
  );
}

/** Which accounts are actually spending the money, by who placed the order. */
export function accountBreakdown(rows: AccountBudgetRow[]): BreakdownSlice[] {
  return topSlicesWithOther(
    rows.map((row) => ({ key: row.user.id, label: row.user.name, valueUsd: row.spentUsd })),
    'accounts',
  );
}

/** Which accounts are over their allotted budget, by overage dollars only. */
export function accountOverageBreakdown(rows: AccountBudgetRow[]): BreakdownSlice[] {
  return topSlicesWithOther(
    rows.map((row) => ({ key: row.user.id, label: row.user.name, valueUsd: row.overageUsd })),
    'accounts',
  );
}

/**
 * Products bought after an account exhausts its budget. The crossing order contributes only the
 * dollars above the cap; every later order for that account contributes in full.
 */
export function overBudgetProductBreakdown(
  hospiceId: string,
  period: CostPeriod,
  rows: AccountBudgetRow[],
): BreakdownSlice[] {
  const rowByUserId = new Map(rows.map((row) => [row.user.id, row]));
  const runningSpendByUserId = new Map<string, number>();
  const productSpend = new Map<string, { label: string; valueUsd: number }>();

  const orders = getOrdersForHospice(hospiceId)
    .filter((order) => periodContains(period, order.orderedAt) && order.orderedById !== null)
    .filter((order) => {
      const row = rowByUserId.get(order.orderedById ?? '');
      return row !== undefined && row.capUsd !== null;
    })
    .slice()
    .sort((a, b) => (a.orderedAt ?? '').localeCompare(b.orderedAt ?? '') || a.id.localeCompare(b.id));

  for (const order of orders) {
    const userId = order.orderedById;
    if (userId === null) continue;
    const row = rowByUserId.get(userId);
    if (!row || row.capUsd === null) continue;

    let runningSpend = runningSpendByUserId.get(userId) ?? 0;
    const capUsd = row.capUsd;

    for (const item of order.equipment) {
      const itemUsd = orderItemExtendedUsd(order, item, period);
      const beforeOverage = Math.max(0, runningSpend - capUsd);
      runningSpend += itemUsd;
      const afterOverage = Math.max(0, runningSpend - capUsd);
      const overBudgetUsd = round2(afterOverage - beforeOverage);
      if (overBudgetUsd <= 0) continue;

      const current = productSpend.get(item.hcpcs);
      productSpend.set(item.hcpcs, {
        label: current?.label ?? item.name,
        valueUsd: round2((current?.valueUsd ?? 0) + overBudgetUsd),
      });
    }

    runningSpendByUserId.set(userId, round2(runningSpend));
  }

  return topSlicesWithOther(
    [...productSpend.entries()].map(([key, value]) => ({ key, ...value })),
    'codes',
  );
}

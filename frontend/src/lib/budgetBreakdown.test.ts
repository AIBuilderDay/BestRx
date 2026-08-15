import { describe, expect, it } from 'vitest';
import { NO_OVERRIDES, buildAccountRows } from './budgetLedger';
import { buildBasket } from './costLedger';
import { getPeriod } from './costPeriod';
import { accountBreakdown, productBreakdown } from './budgetBreakdown';

const period = getPeriod('aug-2026');
const lines = buildBasket('HSP-001', period);
const rows = buildAccountRows('HSP-001', period, NO_OVERRIDES);

describe('productBreakdown', () => {
  const slices = productBreakdown(lines);

  it('caps at 4 slices, top codes named and the remainder folded into Other', () => {
    expect(slices).toHaveLength(4);
    expect(slices.map((s) => s.key)).toEqual(['E0250', 'E0277', 'E1390', 'other']);
  });

  it('sums back to the real total spend', () => {
    const sum = slices.reduce((total, s) => total + s.valueUsd, 0);
    const realTotal = lines.reduce((total, l) => total + l.actualUsd, 0);
    expect(sum).toBeCloseTo(realTotal, 1);
  });

  it('matches the real per-code paid figures exactly', () => {
    expect(slices.find((s) => s.key === 'E0250')?.valueUsd).toBeCloseTo(6484, 0);
    expect(slices.find((s) => s.key === 'E0277')?.valueUsd).toBeCloseTo(5898, 0);
    expect(slices.find((s) => s.key === 'other')?.valueUsd).toBeCloseTo(2284, 0);
  });

  it('sorts the named slices biggest first, with Other trailing regardless of its own size', () => {
    const named = slices.filter((s) => s.key !== 'other');
    for (let i = 1; i < named.length; i += 1) {
      expect(named[i].valueUsd, `slice ${i}`).toBeLessThanOrEqual(named[i - 1].valueUsd);
    }
    expect(slices[slices.length - 1].key).toBe('other');
  });
});

describe('accountBreakdown', () => {
  const slices = accountBreakdown(rows);

  it('drops zero-spend accounts rather than drawing an invisible sliver', () => {
    // Only 3 of the 5 HSP-001 accounts placed any orders this period.
    expect(slices).toHaveLength(3);
    expect(slices.map((s) => s.label).sort()).toEqual(['Bea Cordova', 'Dana Whitfield', 'Marcus Lee']);
  });

  it('matches the real per-account spend exactly', () => {
    expect(slices.find((s) => s.label === 'Bea Cordova')?.valueUsd).toBeCloseTo(8855.5, 1);
    expect(slices.find((s) => s.label === 'Dana Whitfield')?.valueUsd).toBeCloseTo(6530, 1);
    expect(slices.find((s) => s.label === 'Marcus Lee')?.valueUsd).toBeCloseTo(192.5, 1);
  });

  it('sums exactly to total spend, since no account is folded into Other', () => {
    const sum = slices.reduce((total, s) => total + s.valueUsd, 0);
    expect(sum).toBeCloseTo(15578, 0);
  });
});

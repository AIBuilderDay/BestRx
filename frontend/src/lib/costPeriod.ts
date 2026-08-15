/**
 * Reporting periods for the cost dashboard.
 *
 * The dataset holds a single month of orders (Aug 1-14, 2026), so there is exactly one period
 * today. COST_PERIODS stays an array anyway: adding history becomes a data change rather than a
 * rewrite, and every selector already takes a period rather than assuming "this month".
 *
 * Buckets tile the whole month, so no order can fall outside one. The final bucket runs to the
 * 31st and is wider than a week for that reason.
 */

export interface PeriodBucket {
  key: string;
  /** Axis label, e.g. "Aug 1-7". */
  label: string;
  startIso: string;
  /** Exclusive. */
  endIso: string;
}

export interface CostPeriod {
  key: string;
  label: string;
  /** Days of rent charged in the period — the PPD denominator alongside census. */
  days: number;
  /** Rental months billed in the period. Drives units x price for rental lines. */
  months: number;
  startIso: string;
  endIso: string;
  buckets: PeriodBucket[];
}

const AUGUST_2026: CostPeriod = {
  key: 'aug-2026',
  label: 'August 2026',
  days: 31,
  months: 1,
  startIso: '2026-08-01',
  endIso: '2026-09-01',
  buckets: [
    { key: 'aug-2026-w1', label: 'Aug 1-7', startIso: '2026-08-01', endIso: '2026-08-08' },
    { key: 'aug-2026-w2', label: 'Aug 8-14', startIso: '2026-08-08', endIso: '2026-08-15' },
    { key: 'aug-2026-w3', label: 'Aug 15-21', startIso: '2026-08-15', endIso: '2026-08-22' },
    { key: 'aug-2026-w4', label: 'Aug 22-31', startIso: '2026-08-22', endIso: '2026-09-01' },
  ],
};

export const COST_PERIODS: CostPeriod[] = [AUGUST_2026];
export const DEFAULT_PERIOD_KEY = AUGUST_2026.key;

/** Never throws: an unknown or missing key falls back to the default period. */
export function getPeriod(key: string | null | undefined): CostPeriod {
  return COST_PERIODS.find((p) => p.key === key) ?? AUGUST_2026;
}

/** Compares the date portion only, so a timestamp's -06:00 offset can't shift its bucket. */
const dateOf = (iso: string | null | undefined): string | null => {
  if (typeof iso !== 'string' || iso.length < 10) return null;
  const date = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
};

export function periodContains(period: CostPeriod, iso: string | null | undefined): boolean {
  const date = dateOf(iso);
  return date !== null && date >= period.startIso && date < period.endIso;
}

/** Index into `period.buckets`, or -1 when the timestamp is missing, malformed, or out of range. */
export function bucketIndexFor(period: CostPeriod, iso: string | null | undefined): number {
  const date = dateOf(iso);
  if (date === null) return -1;
  return period.buckets.findIndex((b) => date >= b.startIso && date < b.endIso);
}

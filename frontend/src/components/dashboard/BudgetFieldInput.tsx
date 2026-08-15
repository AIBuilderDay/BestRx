import { useEffect, useState } from 'react';
import { parseRateInput } from '../../lib/budgetLedger';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Editable numeric field for budget config. `unit: 'usd'` edits a flat dollar amount directly;
 * `unit: 'percent'` edits a 0-1 fraction, displayed and typed as 0-100. `readOnly` renders the same
 * formatted value as plain text with no input — used outside edit mode.
 */
export function BudgetFieldInput({
  value,
  unit,
  ariaLabel,
  onCommit,
  readOnly = false,
}: {
  value: number | null;
  unit: 'usd' | 'percent';
  ariaLabel: string;
  onCommit: (next: number | null) => void;
  readOnly?: boolean;
}) {
  const displayValue = value === null ? null : unit === 'percent' ? round2(value * 100) : value;
  const [draft, setDraft] = useState(displayValue === null ? '' : String(displayValue));

  useEffect(() => {
    setDraft(displayValue === null ? '' : String(displayValue));
  }, [displayValue]);

  const commit = () => {
    const parsed = parseRateInput(draft);
    if (parsed === null && draft.trim() !== '') {
      setDraft(displayValue === null ? '' : String(displayValue));
      return;
    }
    onCommit(parsed === null ? null : unit === 'percent' ? round2(parsed) / 100 : parsed);
  };

  if (readOnly) {
    return (
      <span aria-label={ariaLabel} className="font-mono text-[13px] tabular-nums text-ink">
        {unit === 'usd' ? '$' : ''}
        {displayValue === null ? '—' : displayValue}
        {unit === 'percent' ? '%' : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-control border border-line-strong bg-surface px-2 py-1 focus-within:border-ink">
      {unit === 'usd' ? <span className="text-ink-3">$</span> : null}
      <input
        value={draft}
        aria-label={ariaLabel}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(displayValue === null ? '' : String(displayValue));
            e.currentTarget.blur();
          }
        }}
        className={`bg-transparent text-right font-mono text-[13px] tabular-nums text-ink outline-none ${
          unit === 'usd' ? 'w-20' : 'w-12'
        }`}
      />
      {unit === 'percent' ? <span className="text-ink-3">%</span> : null}
    </span>
  );
}

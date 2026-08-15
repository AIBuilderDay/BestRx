import { useEffect, useState } from 'react';
import { parseRateInput } from '../../lib/budgetLedger';

/**
 * Holds its own raw text so a half-typed "8." isn't reformatted out from under the caret. The
 * parsed value is pushed up only when it's valid; the mockup rebuilt these inputs on every
 * keystroke, which lost focus mid-edit.
 */
export function PpdRateInput({
  value,
  ariaLabel,
  onCommit,
}: {
  value: number | null;
  ariaLabel: string;
  onCommit: (next: number | null) => void;
}) {
  const [raw, setRaw] = useState(value === null ? '' : String(value));

  // Resync when the value changes from outside (a role default moving, or an override cleared).
  useEffect(() => {
    setRaw(value === null ? '' : String(value));
  }, [value]);

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-ink-3">$</span>
      <input
        type="number"
        step="0.25"
        min="0"
        inputMode="decimal"
        value={raw}
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          setRaw(e.target.value);
          onCommit(parseRateInput(e.target.value));
        }}
        className="quantity-input w-[68px] rounded-control border border-line-strong bg-surface px-1.5 py-1 text-right text-[13px] tabular-nums text-ink"
      />
    </span>
  );
}

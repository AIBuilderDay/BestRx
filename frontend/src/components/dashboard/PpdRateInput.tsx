import { useEffect, useState } from 'react';
import { parseRateInput } from '../../lib/budgetLedger';

export function PpdRateInput({
  value,
  ariaLabel,
  onCommit,
}: {
  value: number | null;
  ariaLabel: string;
  onCommit: (next: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));

  useEffect(() => {
    setDraft(value === null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseRateInput(draft);
    if (parsed === null && draft.trim() !== '') {
      setDraft(value === null ? '' : String(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <span className="inline-flex items-center rounded-control border border-line-strong bg-surface px-2 py-1 focus-within:border-ink">
      <span className="text-ink-3">$</span>
      <input
        value={draft}
        aria-label={ariaLabel}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(value === null ? '' : String(value));
            e.currentTarget.blur();
          }
        }}
        className="w-16 bg-transparent text-right font-mono text-[13px] tabular-nums text-ink outline-none"
      />
    </span>
  );
}

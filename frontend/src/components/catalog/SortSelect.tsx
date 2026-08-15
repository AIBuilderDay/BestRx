import { useEffect, useRef, useState } from 'react';

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-none text-ink-3"
    >
      <path d="M2.5 6.5 6 3l3.5 3.5" />
      <path d="M2.5 9.5 6 13l3.5-3.5" />
    </svg>
  );
}

/**
 * A short, fixed list of choices styled like the vendor picker, so the two dropdowns on a detail
 * page read as one control. No search box — the option count is small enough to scan.
 */
export function SortSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  onOpenChange,
}: {
  value: T;
  /** Option order is the display order. */
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
  /** Lets the page lift this control's stacking context so the menu is not painted over. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const current = options.find((o) => o.value === value);

  const pick = (next: T) => {
    setOpen(false);
    if (next !== value) onChange(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 border bg-surface px-3 py-2 text-left text-[13px] text-ink transition-colors hover:border-ink ${
          open ? 'border-ink' : 'border-line-strong'
        }`}
      >
        <span className="min-w-0 truncate">{current?.label ?? ''}</span>
        <ChevronIcon />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-10 min-w-full border border-line bg-surface shadow-sm">
          <div role="listbox" aria-label={ariaLabel}>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 whitespace-nowrap border-b border-line px-3 py-2 text-left text-[13px] transition-colors last:border-b-0 hover:bg-hover ${
                  o.value === value ? 'bg-hover text-ink' : 'text-ink-2'
                }`}
              >
                <span>{o.label}</span>
                {o.value === value ? <span className="text-[11px] text-ink-3">Current</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

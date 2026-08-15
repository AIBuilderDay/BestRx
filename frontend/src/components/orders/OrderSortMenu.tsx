import { useEffect, useRef, useState } from 'react';
import type { OrderSortKey } from '../../lib/orders';
import { Tooltip } from '../ui/Tooltip';

const SORTS: { key: OrderSortKey; label: string }[] = [
  { key: 'recent', label: 'Most recent' },
  { key: 'status', label: 'Status' },
];

/** Up arrow on the left, down arrow on the right. */
function SortIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 16V6" />
      <path d="M4 10 7 6 10 10" />
      <path d="M17 8v10" />
      <path d="M14 14 17 18 20 14" />
    </svg>
  );
}

/** Opens a menu to pick how orders are sorted. */
export function OrderSortMenu({
  sort,
  onChange,
}: {
  sort: OrderSortKey;
  onChange: (sort: OrderSortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (key: OrderSortKey) => {
    onChange(key);
    setOpen(false);
  };

  const activeLabel = SORTS.find((s) => s.key === sort)?.label ?? 'Most recent';

  return (
    <div ref={rootRef} className="relative">
      <Tooltip label={`Sort orders — ${activeLabel}`} placement="left" hidden={open}>
        <button
          type="button"
          aria-label={`Sort orders — ${activeLabel}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((v) => !v)}
          className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3.5 text-[13px] transition-colors hover:border-ink sm:w-10 sm:px-0 ${
            open || sort !== 'recent' ? 'border-ink bg-hover text-ink' : 'border-line-strong bg-surface text-ink-2'
          }`}
        >
          <SortIcon />
          <span className="sm:hidden">Sort</span>
        </button>
      </Tooltip>

      {open ? (
        <div
          role="listbox"
          aria-label="Sort by"
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[180px] overflow-hidden rounded-lg border border-line bg-surface"
        >
          <div className="border-b border-line px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Sort by
          </div>
          <div className="grid gap-0.5 p-1">
            {SORTS.map((s) => {
              const on = sort === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(s.key)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover"
                >
                  <span
                    className={`grid h-3 w-3 flex-none place-items-center rounded-full border transition-colors ${
                      on ? 'border-ink' : 'border-line-strong'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full bg-ink ${on ? 'scale-100' : 'scale-0'} transition-transform`}
                    />
                  </span>
                  <span className={on ? 'text-ink' : 'text-ink-2'}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

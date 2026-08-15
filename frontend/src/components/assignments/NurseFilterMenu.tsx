import { useEffect, useRef, useState } from 'react';
import type { User } from '../../types/domain';

function FilterIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
    </svg>
  );
}

/** Filters the patient list by the nurse currently assigned. `null` shows everyone. */
export function NurseFilterMenu({
  nurses,
  value,
  counts,
  onChange,
}: {
  nurses: User[];
  value: string | null;
  counts: Record<string, number>;
  onChange: (nurseId: string | null) => void;
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

  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  const activeLabel = value ? (nurses.find((n) => n.id === value)?.name ?? 'All nurses') : 'All nurses';

  const options: { id: string | null; label: string }[] = [
    { id: null, label: 'All nurses' },
    ...nurses.map((n) => ({ id: n.id, label: n.name })),
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Filter by nurse — ${activeLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Filter by assigned nurse"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-[13px] transition-colors hover:border-ink ${
          open || value !== null ? 'border-ink bg-hover text-ink' : 'border-line-strong bg-surface text-ink-2'
        }`}
      >
        <FilterIcon />
        <span>{activeLabel}</span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Filter by nurse"
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[220px] overflow-hidden rounded-lg border border-line bg-surface"
        >
          <div className="border-b border-line px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Filter by nurse
          </div>
          <div className="grid gap-0.5 p-1">
            {options.map((o) => {
              const on = value === o.id;
              const count = o.id ? (counts[o.id] ?? 0) : null;
              return (
                <button
                  key={o.id ?? 'all'}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(o.id)}
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
                  <span className={`flex-1 ${on ? 'text-ink' : 'text-ink-2'}`}>{o.label}</span>
                  {count !== null ? <span className="tabular-nums text-ink-3">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { ROLE_LABELS } from '../../lib/auth';
import type { User } from '../../types/domain';

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-none text-ink-3"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-none text-ink"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** A searchable nurse picker — replaces a native <select> so a long team can be searched by name. */
export function NurseSelect({
  nurses,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  nurses: User[];
  value: string;
  onChange: (nurseId: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Focus the search box on open; clear the query on close so it reopens fresh.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  const current = nurses.find((n) => n.id === value);
  const buttonLabel = current ? `${current.name} · ${ROLE_LABELS[current.role]}` : 'Unassigned nurse';

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nurses;
    return nurses.filter(
      (n) => n.name.toLowerCase().includes(q) || ROLE_LABELS[n.role].toLowerCase().includes(q),
    );
  }, [nurses, query]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className ?? ''}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-bg px-3 py-2 text-left text-[12.5px] text-ink transition-colors hover:border-ink sm:w-56 ${
          open ? 'border-ink' : 'border-line-strong'
        }`}
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronIcon />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-lg border border-line bg-surface sm:left-auto sm:right-0 sm:w-64">
          <div className="border-b border-line p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nurses…"
              aria-label="Search nurses"
              className="w-full rounded-md border border-line-strong bg-bg px-2.5 py-1.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink"
            />
          </div>
          <div role="listbox" aria-label="Nurses" className="max-h-56 overflow-y-auto p-1">
            {results.length === 0 ? (
              <div className="px-2 py-2 text-[12.5px] text-ink-3">No nurses match.</div>
            ) : (
              results.map((n) => {
                const on = n.id === value;
                return (
                  <button
                    key={n.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => pick(n.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-hover"
                  >
                    <span className={`flex-1 truncate ${on ? 'text-ink' : 'text-ink-2'}`}>
                      {n.name} · {ROLE_LABELS[n.role]}
                    </span>
                    {on ? <CheckIcon /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

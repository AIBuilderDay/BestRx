import { useEffect, useMemo, useRef, useState } from 'react';
import { moneyLabel, searchVendorChoices, type VendorChoice } from '../../lib/catalog';

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

function SearchIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function priceText(choice: VendorChoice): string {
  return moneyLabel(choice.price.amount) + (choice.price.unit === '/mo' ? '/mo' : '');
}

/** A saving reads as a saving, not as a signed number the reader has to interpret. */
function deltaText(delta: number): string {
  return delta < 0 ? `save ${moneyLabel(-delta)}` : `+${moneyLabel(delta)}`;
}

/**
 * Vendor picker for one product: every vendor selling the same HCPCS, each with its own price,
 * rating, and lead time. Picking one repoints the page at that vendor's offer, so the price and
 * delivery shown always belong to the vendor named. Searchable, because the vendor list grows
 * faster than the catalog does.
 */
export function VendorSelect({
  choices,
  onSelect,
  onOpenChange,
}: {
  choices: VendorChoice[];
  onSelect: (offerId: string) => void;
  /** Lets the page lift this control's stacking context so the menu is not painted over. */
  onOpenChange?: (open: boolean) => void;
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

  // Focus the search box on open; clear the query on close so it reopens fresh.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const current = choices.find((c) => c.current);
  const results = useMemo(() => searchVendorChoices(choices, query), [choices, query]);

  // One vendor sells it — there is nothing to pick between, so this is a label, not a control.
  if (choices.length < 2) {
    return (
      <div className="flex w-full items-center justify-between gap-3 border border-line bg-surface px-3 py-2 text-[13px]">
        <span className="min-w-0 truncate text-ink">{current?.displayName ?? 'Vendor'}</span>
        {current?.rating ? (
          <span className="flex-none font-mono tabular-nums text-xs text-ink-2">
            {current.rating.average.toFixed(1)} <span aria-hidden>★</span>
          </span>
        ) : null}
      </div>
    );
  }

  const pick = (offerId: string) => {
    setOpen(false);
    if (offerId !== current?.offerId) onSelect(offerId);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Change vendor"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 border bg-surface px-3 py-2 text-left text-[13px] text-ink transition-colors hover:border-ink ${
          open ? 'border-ink' : 'border-line-strong'
        }`}
      >
        <span className="min-w-0 truncate">{current?.displayName ?? 'Choose a vendor'}</span>
        <span className="flex flex-none items-center gap-2">
          {current?.rating ? (
            <span className="font-mono tabular-nums text-xs text-ink-2">
              {current.rating.average.toFixed(1)} <span aria-hidden>★</span>
            </span>
          ) : null}
          <ChevronIcon />
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 border border-line bg-surface shadow-sm">
          <div className="border-b border-line p-2">
            <div className="relative">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vendors…"
                aria-label="Search vendors"
                className="w-full border border-line-strong bg-bg py-1.5 pl-7 pr-2.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink"
              />
            </div>
          </div>
          <div role="listbox" aria-label="Vendors selling this item" className="max-h-60 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-3 py-2.5 text-[12.5px] text-ink-3">No vendors match.</div>
            ) : (
              results.map((c) => (
                <button
                  key={c.offerId}
                  type="button"
                  role="option"
                  aria-selected={c.current}
                  onClick={() => pick(c.offerId)}
                  className={`flex w-full cursor-pointer flex-col gap-0.5 border-b border-line px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-hover ${
                    c.current ? 'bg-hover' : ''
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`min-w-0 truncate text-[13px] ${c.current ? 'text-ink' : 'text-ink-2'}`}>
                      {c.displayName}
                    </span>
                    <span className="flex-none font-mono text-[13px] tabular-nums text-ink">
                      {priceText(c)}
                    </span>
                  </span>
                  <span className="flex items-baseline justify-between gap-3 text-[11px] text-ink-3">
                    <span>
                      {c.rating ? `${c.rating.average.toFixed(1)} ★ · ` : ''}
                      {c.leadDays} {c.leadDays === 1 ? 'day' : 'days'}
                    </span>
                    {c.current ? (
                      <span>Current</span>
                    ) : c.priceDelta !== 0 ? (
                      <span className={c.priceDelta < 0 ? 'text-good' : 'text-ink-3'}>
                        {deltaText(c.priceDelta)}
                      </span>
                    ) : (
                      <span>Same price</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

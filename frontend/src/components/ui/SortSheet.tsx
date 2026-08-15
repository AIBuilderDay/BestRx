/**
 * Mobile sort picker — a tap sheet listing the same options the desktop sort control offers.
 * Generic over the sort-key type so any list view can drive it. Square edges, tokens only.
 */
export function SortSheet<T extends string>({
  open,
  value,
  options,
  onSelect,
  onClose,
}: {
  open: boolean;
  value: T;
  options: { key: T; label: string; hint?: string }[];
  onSelect: (key: T) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/20 sm:place-items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full animate-sheet-in border border-ink bg-surface p-5.5 motion-reduce:animate-none sm:max-w-[420px]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.1em] text-ink-3">Sort by</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-[15px] leading-none text-ink-3 transition-transform hover:rotate-90 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-0.5">
          {options.map((s) => {
            const on = value === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  onSelect(s.key);
                  onClose();
                }}
                className={`flex items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-hover ${on ? 'bg-hover' : ''}`}
              >
                <span className="grid gap-0.5">
                  <span className={`text-[14px] ${on ? 'text-ink' : 'text-ink-2'}`}>{s.label}</span>
                  {s.hint ? <span className="text-[11px] text-ink-3">{s.hint}</span> : null}
                </span>
                <span
                  className={`grid h-4 w-4 flex-none place-items-center rounded-full border transition-colors ${
                    on ? 'border-ink' : 'border-line-strong'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full bg-ink transition-transform ${on ? 'scale-100' : 'scale-0'}`} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

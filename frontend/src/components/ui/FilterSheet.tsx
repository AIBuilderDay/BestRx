import type { ReactNode } from 'react';

/**
 * Mobile filter sheet chrome — a scrollable bottom sheet with a title, the caller's controls,
 * and a "Show N results" footer. The controls (and any search box that narrows them) are passed
 * as children so each list view supplies its own filters while sharing this frame.
 */
export function FilterSheet({
  open,
  title = 'Filters',
  resultCount,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  resultCount: number;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/20 sm:place-items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full animate-sheet-in flex-col border border-ink bg-surface motion-reduce:animate-none sm:max-w-[420px]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5.5 py-4">
          <div className="text-[11px] uppercase tracking-[0.1em] text-ink-3">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-[15px] leading-none text-ink-3 transition-transform hover:rotate-90 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5.5 pb-5 pt-4">{children}</div>

        <div className="border-t border-line p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full border border-solid-bg bg-solid-bg py-3.5 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85"
          >
            Show {resultCount} result{resultCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

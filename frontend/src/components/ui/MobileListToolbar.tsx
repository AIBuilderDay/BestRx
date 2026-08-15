/**
 * Mobile-only bar under the search: result count on the left, Sort + Filters triggers on the
 * right. Hidden at lg, where a desktop sidebar and sort control take over. Square edges, tokens
 * only. Shared by the Catalog and Orders list views so the two read as one system.
 */
export function MobileListToolbar({
  resultText,
  filterCount,
  onOpenSort,
  onOpenFilters,
}: {
  resultText: string;
  filterCount: number;
  onOpenSort: () => void;
  onOpenFilters: () => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
      <span className="font-mono text-xs tabular-nums text-ink-3">{resultText}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSort}
          className="flex items-center gap-1.5 border border-line-strong bg-surface px-3.5 py-2 text-xs text-ink transition-colors hover:border-ink"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M7 4v16M7 4 4 7m3-3 3 3M17 20V4m0 16 3-3m-3 3-3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sort
        </button>
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex items-center gap-1.5 border border-solid-bg bg-solid-bg px-3.5 py-2 text-xs text-solid-ink transition-opacity hover:opacity-85"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 6h18M6 12h12M10 18h4" strokeLinecap="round" />
          </svg>
          Filters
          {filterCount > 0 ? <span className="font-mono tabular-nums">· {filterCount}</span> : null}
        </button>
      </div>
    </div>
  );
}

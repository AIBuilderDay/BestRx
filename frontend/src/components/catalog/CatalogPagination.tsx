import { Tooltip } from '../ui/Tooltip';

export function CatalogPagination({
  page,
  totalPages,
  firstItem,
  lastItem,
  totalItems,
  onPageChange,
  ariaLabel = 'Catalog pages',
}: {
  page: number;
  totalPages: number;
  firstItem: number;
  lastItem: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"
    >
      <div className="font-mono text-[11px] tabular-nums text-ink-3">
        {firstItem}–{lastItem} of {totalItems} items
      </div>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Tooltip label="Previous page" placement="top">
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => onPageChange(page - 1)}
              className="h-8 min-w-8 border border-line-strong px-2 text-sm transition-colors hover:border-ink"
            >
              ←
            </button>
          </Tooltip>
        ) : null}
        <span
          aria-current="page"
          aria-label={`Page ${page} of ${totalPages}`}
          className="flex h-8 min-w-8 items-center justify-center border border-solid-bg bg-solid-bg px-2 font-mono text-xs tabular-nums text-solid-ink"
        >
          {page}
        </span>
        {page < totalPages ? (
          <Tooltip label="Next page" placement="top">
            <button
              type="button"
              aria-label="Next page"
              onClick={() => onPageChange(page + 1)}
              className="h-8 min-w-8 border border-line-strong px-2 text-sm transition-colors hover:border-ink"
            >
              →
            </button>
          </Tooltip>
        ) : null}
      </div>
    </nav>
  );
}

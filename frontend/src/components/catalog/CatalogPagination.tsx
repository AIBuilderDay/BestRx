import { Tooltip } from '../ui/Tooltip';

const MAX_VISIBLE_PAGES = 3;

function visiblePageWindow(page: number, totalPages: number, windowSize = MAX_VISIBLE_PAGES): number[] {
  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1));
  return Array.from({ length: windowSize }, (_, index) => start + index);
}

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
  const pages = visiblePageWindow(page, totalPages);

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
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            aria-current={pageNumber === page ? 'page' : undefined}
            aria-label={`Page ${pageNumber}`}
            onClick={() => onPageChange(pageNumber)}
            className={`h-8 min-w-8 border px-2 font-mono text-xs tabular-nums transition-colors ${
              pageNumber === page
                ? 'border-solid-bg bg-solid-bg text-solid-ink'
                : 'border-line-strong bg-surface hover:border-ink'
            }`}
          >
            {pageNumber}
          </button>
        ))}
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

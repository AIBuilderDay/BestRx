export function CatalogPagination({
  page,
  totalPages,
  firstItem,
  lastItem,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  firstItem: number;
  lastItem: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label="Catalog pages"
      className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"
    >
      <div className="font-mono text-[11px] tabular-nums text-ink-3">
        {firstItem}–{lastItem} of {totalItems} items
      </div>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <button
            type="button"
            aria-label="Previous page"
            title="Previous page"
            onClick={() => onPageChange(page - 1)}
            className="h-8 min-w-8 border border-line-strong px-2 text-sm transition-colors hover:border-ink"
          >
            ←
          </button>
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
          <button
            type="button"
            aria-label="Next page"
            title="Next page"
            onClick={() => onPageChange(page + 1)}
            className="h-8 min-w-8 border border-line-strong px-2 text-sm transition-colors hover:border-ink"
          >
            →
          </button>
        ) : null}
      </div>
    </nav>
  );
}

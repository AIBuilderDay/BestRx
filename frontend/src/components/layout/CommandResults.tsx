import type { CommandGroup, CommandResult } from '../../lib/commandSearch';

/**
 * The command bar's results dropdown: grouped jumps (pages, patients, orders, catalog) under an
 * optional "filter this page" row.
 *
 * Presentational only — it renders what `searchCommands` already permission-filtered, and reports
 * picks upward. Keyboard state lives in <NavSearch>, which owns the input.
 */

export interface FilterRow {
  /** "Filter Orders for 'Harold'" — describes the filtering that is already live on the page. */
  label: string;
  meta: string;
}

/** Sentinel id for the filter row, which is not a `CommandResult`. */
export const FILTER_ROW_ID = 'filter-in-place';

const GROUP_ICONS: Record<CommandResult['group'], string> = {
  page: 'M4 6h16M4 12h16M4 18h10',
  patient: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  order: 'M6 2h9l5 5v15H6V2Zm9 0v5h5M9 13h7M9 17h5',
  catalog: 'M3 9h18M3 9l1.5 11h15L21 9M3 9l2-5h14l2 5M9 13v3M15 13v3',
};

export function CommandResults({
  groups,
  filterRow,
  activeId,
  onPick,
  onPickFilter,
  onHoverItem,
}: {
  groups: CommandGroup[];
  filterRow: FilterRow | null;
  activeId: string | null;
  onPick: (result: CommandResult) => void;
  onPickFilter: () => void;
  onHoverItem: (id: string | null) => void;
}) {
  if (!filterRow && groups.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Search results"
      className="profile-menu-panel absolute left-0 top-[calc(100%+8px)] z-30 max-h-[min(70vh,460px)] w-full overflow-y-auto rounded-panel border border-line bg-surface p-1.5 shadow-lg"
    >
      {filterRow ? (
        <button
          type="button"
          role="option"
          aria-selected={activeId === FILTER_ROW_ID}
          onMouseEnter={() => onHoverItem(FILTER_ROW_ID)}
          onMouseLeave={() => onHoverItem(null)}
          onClick={onPickFilter}
          className={`mb-1 flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-left transition-colors ${
            activeId === FILTER_ROW_ID ? 'bg-hover' : ''
          }`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-ink-3"
            aria-hidden="true"
          >
            <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] text-ink">{filterRow.label}</span>
            <span className="block truncate text-[11px] text-ink-3">{filterRow.meta}</span>
          </span>
        </button>
      ) : null}

      {groups.map((group) => (
        <div key={group.key} className="mb-1 last:mb-0">
          <p className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.09em] text-ink-3">
            {group.label}
          </p>
          {group.results.map((result) => (
            <button
              key={result.id}
              type="button"
              role="option"
              aria-selected={activeId === result.id}
              onMouseEnter={() => onHoverItem(result.id)}
              onMouseLeave={() => onHoverItem(null)}
              onClick={() => onPick(result)}
              className={`flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left transition-colors ${
                activeId === result.id ? 'bg-hover' : ''
              }`}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                className="shrink-0 text-ink-3"
                aria-hidden="true"
              >
                <path d={GROUP_ICONS[result.group]} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-ink">{result.label}</span>
                <span className="block truncate text-[11px] text-ink-3">{result.meta}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

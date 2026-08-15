export type StatTone = 'plain' | 'good' | 'alert';

export interface StatTileVM {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: StatTone;
  /** False for a tile with nothing to chart (e.g. utilization when no account has a derived cap). */
  chartable?: boolean;
}

const TONE_BORDER: Record<StatTone, string> = {
  plain: 'border-line',
  good: 'border-line',
  alert: 'border-warn',
};

const TONE_VALUE: Record<StatTone, string> = {
  plain: 'text-ink',
  good: 'text-good',
  alert: 'text-warn',
};

export function StatTiles({
  tiles,
  selectedKey,
  onSelect,
}: {
  tiles: StatTileVM[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {tiles.map((tile) => {
        const chartable = tile.chartable !== false;
        const selected = tile.key === selectedKey;
        return (
          <button
            key={tile.key}
            type="button"
            disabled={!chartable}
            aria-pressed={selected}
            onClick={() => onSelect(tile.key)}
            title={chartable ? 'Show trend chart' : 'Not enough data to chart'}
            className={`rounded-card border bg-surface px-3.5 py-2.5 text-left transition-colors ${TONE_BORDER[tile.tone]} ${
              selected
                ? 'border-ink ring-1 ring-ink'
                : chartable
                  ? 'hover:border-ink'
                  : 'cursor-default opacity-70'
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.06em] text-ink-3">{tile.label}</div>
            <div className={`mt-1 text-[23px] font-semibold tabular-nums ${TONE_VALUE[tile.tone]}`}>
              {tile.value}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-3">{tile.detail}</div>
          </button>
        );
      })}
    </div>
  );
}

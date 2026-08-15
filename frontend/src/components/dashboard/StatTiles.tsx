export type StatTone = 'plain' | 'good' | 'alert';

export interface StatTileVM {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: StatTone;
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

export function StatTiles({ tiles }: { tiles: StatTileVM[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className={`rounded-card border bg-surface px-3.5 py-2.5 ${TONE_BORDER[tile.tone]}`}
        >
          <div className="text-[11px] uppercase tracking-[0.06em] text-ink-3">{tile.label}</div>
          <div className={`mt-1 text-[23px] font-semibold tabular-nums ${TONE_VALUE[tile.tone]}`}>
            {tile.value}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-3">{tile.detail}</div>
        </div>
      ))}
    </div>
  );
}

/** Utilization bar. An unmeasurable row shows an empty track and a dash, never 0% or Infinity. */
export function UtilizationMeter({ pct }: { pct: number | null }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-[3px] bg-track">
        {pct === null ? null : (
          <div
            className={`h-full ${pct >= 90 ? 'bg-warn' : 'bg-good'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        )}
      </div>
      <span className="w-9 text-right tabular-nums text-ink-2">{pct === null ? '—' : `${pct}%`}</span>
    </div>
  );
}

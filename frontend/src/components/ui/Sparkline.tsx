import { sparklineGeometry } from '../../lib/chartScale';
import { moneyLabel } from '../../lib/catalog';

const WIDTH = 76;
const HEIGHT = 22;
const PAD = 3;

const percentChange = (first: number, last: number): string => {
  if (first === 0) return last === 0 ? '0%' : '+100%';
  const pct = Math.round(((last - first) / first) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
};

/**
 * One row's spend trend as a small multiple. Renders a dash instead of a line when the series has
 * no real movement — a flat line would imply steady spend the data doesn't show.
 */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const geometry = sparklineGeometry(values, WIDTH, HEIGHT, PAD);
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const isRising = geometry.direction === 'rising';
  const trendClass = isRising ? 'text-good' : 'text-risk';
  const changeLabel = percentChange(first, last);

  if (!geometry.usable) {
    return (
      <span
        className="inline-flex min-w-[128px] items-center justify-end gap-2 text-ink-3"
        title={`${label}: not enough movement to chart`}
      >
        <span>—</span>
        <span className="w-10 text-right tabular-nums">0%</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex min-w-[128px] items-center justify-end gap-2 ${trendClass}`}
      aria-label={`${label}: ${geometry.direction}, ${moneyLabel(first)} to ${moneyLabel(last)}, ${changeLabel}`}
    >
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        <path d={geometry.d} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.72} />
        <circle cx={geometry.last.x} cy={geometry.last.y} r={2} fill="currentColor" />
      </svg>
      <span className="w-10 text-right text-[12px] font-medium tabular-nums">{changeLabel}</span>
    </span>
  );
}

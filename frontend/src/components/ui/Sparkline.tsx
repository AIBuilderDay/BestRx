import { sparklineGeometry } from '../../lib/chartScale';
import { moneyLabel } from '../../lib/catalog';

const WIDTH = 76;
const HEIGHT = 22;
const PAD = 3;

/**
 * One row's spend trend as a small multiple. Renders a dash instead of a line when the series has
 * no real movement — a flat line would imply steady spend the data doesn't show.
 */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const geometry = sparklineGeometry(values, WIDTH, HEIGHT, PAD);

  if (!geometry.usable) {
    return (
      <span className="text-ink-3" title={`${label}: not enough movement to chart`}>
        —
      </span>
    );
  }

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="text-ink-2"
      role="img"
      aria-label={`${label}: ${geometry.direction}, ${moneyLabel(first)} to ${moneyLabel(last)}`}
    >
      <path d={geometry.d} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.55} />
      <circle cx={geometry.last.x} cy={geometry.last.y} r={2} fill="currentColor" />
    </svg>
  );
}

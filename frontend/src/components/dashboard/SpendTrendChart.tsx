import {
  areaPath,
  bandPath,
  hitBands,
  linePath,
  niceScale,
  toPoints,
  TREND_BOX,
  yAt,
} from '../../lib/chartScale';
import { moneyCompact, moneyLabel } from '../../lib/catalog';
import type { TrendBucket } from '../../lib/costLedger';

/**
 * Hand-rolled SVG, all geometry in viewBox units. Nothing here measures the DOM, so the chart and
 * its tooltip scale with CSS and need no resize listener.
 */
export function SpendTrendChart({
  buckets,
  compareEnabled,
  hoverIndex,
  onHoverIndex,
}: {
  buckets: TrendBucket[];
  compareEnabled: boolean;
  hoverIndex: number | null;
  onHoverIndex: (index: number | null) => void;
}) {
  const actual = buckets.map((b) => b.actualUsd);
  const qualified = buckets.map((b) => b.qualifiedUsd);
  const scale = niceScale(Math.max(...actual, ...(compareEnabled ? qualified : [0])));

  const actualPoints = toPoints(TREND_BOX, actual, scale.top);
  const qualifiedPoints = toPoints(TREND_BOX, qualified, scale.top);
  const baseline = yAt(TREND_BOX, 0, scale.top);
  const bands = hitBands(TREND_BOX, buckets.length);
  const qualifiedCostsMore =
    qualified.reduce((a, b) => a + b, 0) > actual.reduce((a, b) => a + b, 0);

  const summary = `Spend by order date, ${moneyLabel(actual[0] ?? 0)} to ${moneyLabel(actual[actual.length - 1] ?? 0)} across ${buckets.length} buckets.`;

  return (
    <svg
      viewBox={`0 0 ${TREND_BOX.width} ${TREND_BOX.height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={summary}
    >
      {scale.ticks.map((tick) => {
        const y = yAt(TREND_BOX, tick, scale.top);
        return (
          <g key={tick}>
            <line
              x1={TREND_BOX.left}
              x2={TREND_BOX.width - TREND_BOX.right}
              y1={y}
              y2={y}
              className="stroke-line"
              strokeWidth={1}
            />
            <text x={TREND_BOX.left - 8} y={y + 4} textAnchor="end" className="fill-ink-3 text-[11px]">
              {moneyCompact(tick)}
            </text>
          </g>
        );
      })}

      {/* The band is the gap between what was paid and the qualified vendor's price. It is only
          money saved when the qualified line sits below; when it sits above, the gap is a premium
          and must not be painted in the "good" colour. */}
      {compareEnabled ? (
        <path
          d={bandPath(actualPoints, qualifiedPoints)}
          className={qualifiedCostsMore ? 'fill-warn' : 'fill-good'}
          opacity={0.13}
        />
      ) : null}

      <path d={areaPath(actualPoints, baseline)} className="fill-ink" opacity={0.07} />
      <path d={linePath(actualPoints)} fill="none" className="stroke-ink" strokeWidth={2} />

      {compareEnabled ? (
        <path
          d={linePath(qualifiedPoints)}
          fill="none"
          className="stroke-good"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      ) : null}

      {actualPoints.map((point, i) => (
        <circle
          key={buckets[i].label}
          cx={point.x}
          cy={point.y}
          r={3.5}
          className={`stroke-ink ${buckets[i].partial ? 'fill-bg' : 'fill-bg'}`}
          strokeWidth={buckets[i].partial ? 1.2 : 2}
          strokeDasharray={buckets[i].partial ? '2 2' : undefined}
        />
      ))}

      {/* End labels anchor inward so the first and last don't overrun the viewBox and get clipped. */}
      {buckets.map((bucket, i) => (
        <text
          key={bucket.label}
          x={actualPoints[i].x}
          y={TREND_BOX.height - 9}
          textAnchor={i === 0 ? 'start' : i === buckets.length - 1 ? 'end' : 'middle'}
          className="fill-ink-3 text-[11px]"
        >
          {bucket.label}
        </text>
      ))}

      {bands.map((band, i) => (
        <rect
          key={buckets[i].label}
          x={band.x}
          y={TREND_BOX.top}
          width={band.width}
          height={TREND_BOX.height - TREND_BOX.top - TREND_BOX.bottom}
          fill="transparent"
          tabIndex={0}
          role="button"
          aria-label={`${buckets[i].label}: ${moneyLabel(buckets[i].actualUsd)}${
            compareEnabled ? `, qualified alternative ${moneyLabel(buckets[i].qualifiedUsd)}` : ''
          }${buckets[i].partial ? ', partial bucket' : ''}`}
          onMouseEnter={() => onHoverIndex(i)}
          onMouseLeave={() => onHoverIndex(null)}
          onFocus={() => onHoverIndex(i)}
          onBlur={() => onHoverIndex(null)}
          className={hoverIndex === i ? 'outline-none' : undefined}
        />
      ))}
    </svg>
  );
}

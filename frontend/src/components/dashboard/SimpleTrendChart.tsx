import { useState } from 'react';
import { areaPath, hitBands, linePath, niceScale, toPoints, TREND_BOX, yAt } from '../../lib/chartScale';
import type { TrendPoint } from '../../lib/costTrendMock';

/**
 * Single-series version of the vendor spend chart: same geometry and tooltip approach (viewBox
 * units, percentage-positioned tooltip, no resize listener), one line instead of a comparison pair.
 */
export function SimpleTrendChart({
  points,
  formatValue,
}: {
  points: TrendPoint[];
  formatValue: (value: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  // yAt()/niceScale() plot a [0, top] range; shift by however far below zero the series goes so a
  // negative-capable metric (the qualified-vendor delta) still plots correctly, then shift tick and
  // tooltip labels back by the same amount before display.
  const shift = Math.min(0, ...values);
  const scale = niceScale(Math.max(...values, 0) - shift);
  const plotted = toPoints(TREND_BOX, values.map((v) => v - shift), scale.top);
  const baselineY = yAt(TREND_BOX, -shift, scale.top);
  const bands = hitBands(TREND_BOX, points.length);
  const hovered = hoverIndex === null ? null : points[hoverIndex];

  return (
    <div className="relative mt-3">
      <svg
        viewBox={`0 0 ${TREND_BOX.width} ${TREND_BOX.height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${formatValue(values[0] ?? 0)} to ${formatValue(values[values.length - 1] ?? 0)} across ${points.length} points`}
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
                {formatValue(tick + shift)}
              </text>
            </g>
          );
        })}

        <path d={areaPath(plotted, baselineY)} className="fill-ink" opacity={0.07} />
        <path d={linePath(plotted)} fill="none" className="stroke-ink" strokeWidth={2} />

        {plotted.map((point, i) => (
          <circle
            key={points[i].label}
            cx={point.x}
            cy={point.y}
            r={i === plotted.length - 1 ? 4 : 3}
            className="fill-bg stroke-ink"
            strokeWidth={i === plotted.length - 1 ? 2.5 : 2}
          />
        ))}

        {points.map((point, i) => (
          <text
            key={point.label}
            x={plotted[i].x}
            y={TREND_BOX.height - 9}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            className="fill-ink-3 text-[11px]"
          >
            {point.label}
          </text>
        ))}

        {bands.map((band, i) => (
          <rect
            key={points[i].label}
            x={band.x}
            y={TREND_BOX.top}
            width={band.width}
            height={TREND_BOX.height - TREND_BOX.top - TREND_BOX.bottom}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${points[i].label}: ${formatValue(points[i].value)}`}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
            onFocus={() => setHoverIndex(i)}
            onBlur={() => setHoverIndex(null)}
          />
        ))}
      </svg>

      {hovered && hoverIndex !== null ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[120%] rounded-control border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] shadow-sm"
          style={{
            left: `${(plotted[hoverIndex].x / TREND_BOX.width) * 100}%`,
            top: `${(plotted[hoverIndex].y / TREND_BOX.height) * 100}%`,
          }}
        >
          <div className="text-ink-3">{hovered.label}</div>
          <div className="font-medium text-ink tabular-nums">{formatValue(hovered.value)}</div>
        </div>
      ) : null}
    </div>
  );
}

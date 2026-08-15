import { useState } from 'react';
import { moneyLabel } from '../../lib/catalog';
import type { BreakdownSlice } from '../../lib/budgetBreakdown';

/** Fixed categorical order from the design system's four-step ramp — never cycled or reassigned. */
const SLICE_COLOR = ['stroke-s1', 'stroke-s2', 'stroke-s3', 'stroke-s4'];
const SLICE_DOT = ['bg-s1', 'bg-s2', 'bg-s3', 'bg-s4'];

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 84;
const STROKE = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Donut breakdown for part-to-whole spend, capped at 4 slices by the caller (budgetBreakdown.ts).
 * Built from `stroke-dasharray` arcs on a shared circle rather than pie wedges, which keeps every
 * segment a simple 2px-gapped stroke instead of hand-rolled arc paths.
 */
export function DonutChart({ slices, totalLabel }: { slices: BreakdownSlice[]; totalLabel: string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.valueUsd, 0);

  let cursor = 0;
  const arcs = slices.map((slice) => {
    const fraction = total === 0 ? 0 : slice.valueUsd / total;
    // A 2px (in stroke-length terms) gap between segments, matching the design system's spacer rule.
    const gap = slices.length > 1 ? 2 : 0;
    const length = Math.max(0, fraction * CIRCUMFERENCE - gap);
    const offset = -cursor;
    cursor += fraction * CIRCUMFERENCE;
    return { slice, length, offset, pct: Math.round(fraction * 100) };
  });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${totalLabel}, split across ${slices.length} ${slices.length === 1 ? 'slice' : 'slices'}: ${slices
            .map((s) => `${s.label} ${moneyLabel(s.valueUsd)}`)
            .join(', ')}`}
        >
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" className="stroke-track" strokeWidth={STROKE} />
          {arcs.map(({ slice, length, offset, pct }, i) => (
            <g
              key={slice.key}
              className="transition-opacity"
              opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.35}
            >
              {/* A hairline outline half a step lighter than the fill defines every segment's edge
                  regardless of the fill's own contrast against the surface — s4 (#cfcfcf / #3d3d3d)
                  measures under the 2:1 floor against this app's card surface in both themes, so a
                  fill-only ring would be nearly invisible for that slice without this. */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                className="stroke-ink-3 transition-opacity"
                strokeWidth={STROKE + 2}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                className={`${SLICE_COLOR[i]} transition-opacity`}
                strokeWidth={STROKE}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                tabIndex={0}
                role="button"
                aria-label={`${slice.label}: ${moneyLabel(slice.valueUsd)}, ${pct}%`}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
              />
            </g>
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {hoverIndex === null ? (
            <>
              <div className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Total</div>
              <div className="text-[17px] font-semibold tabular-nums text-ink">{totalLabel}</div>
            </>
          ) : (
            <>
              <div className="max-w-[110px] text-center text-[11px] leading-tight text-ink-3">
                {slices[hoverIndex].label}
              </div>
              <div className="text-[15px] font-semibold tabular-nums text-ink">
                {moneyLabel(slices[hoverIndex].valueUsd)}
              </div>
              <div className="text-[11px] text-ink-3">{arcs[hoverIndex].pct}%</div>
            </>
          )}
        </div>
      </div>

      <ul className="min-w-[180px] flex-1 space-y-1.5">
        {arcs.map(({ slice, pct }, i) => (
          <li
            key={slice.key}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
            className={`flex items-center justify-between gap-3 rounded-control px-2 py-1 text-[13px] transition-colors ${
              hoverIndex === i ? 'bg-hover' : ''
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SLICE_DOT[i]}`} />
              <span className="truncate text-ink-2">{slice.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink">
              {moneyLabel(slice.valueUsd)} <span className="text-ink-3">· {pct}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

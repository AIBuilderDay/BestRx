type Tone = 'neutral' | 'good' | 'warn' | 'risk';

const FILL: Record<Tone, string> = {
  neutral: 'bg-ink',
  good: 'bg-good',
  warn: 'bg-warn',
  risk: 'bg-risk',
};

/**
 * Horizontal proportion bar: budget utilization, risk score, vendor on-time rate.
 * Clamps to 0-100 so an over-cap value fills the track instead of overflowing it.
 */
export function Meter({
  value,
  tone = 'neutral',
  label,
  className = '',
}: {
  /** Percentage, 0-100. Values outside the range are clamped. */
  value: number;
  tone?: Tone;
  /** Screen-reader description. Required — a bare bar means nothing without one. */
  label: string;
  className?: string;
}) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-sm bg-track ${className}`}
      role="img"
      aria-label={label}
    >
      <div className={`h-full rounded-sm ${FILL[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

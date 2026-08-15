import type { ReactNode } from 'react';

/** Bordered surface. The default container for anything grouped. */
export function Card({
  className = '',
  emphasis = false,
  children,
}: {
  className?: string;
  /** Draws the border in full-strength ink — use for the one thing that needs attention. */
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border bg-surface p-4 ${emphasis ? 'border-ink' : 'border-line'} ${className}`}
    >
      {children}
    </div>
  );
}

type StatTone = 'neutral' | 'good' | 'warn' | 'risk';

const VALUE_TONE: Record<StatTone, string> = {
  neutral: '',
  good: 'text-good',
  warn: 'text-warn',
  risk: 'text-risk',
};

/** Single number with a label, for the stat row at the top of a view. */
export function Stat({
  label,
  value,
  detail,
  tone = 'neutral',
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  /** Colours the number only. Use it when the number itself is the good or bad news. */
  tone?: StatTone;
  emphasis?: boolean;
}) {
  return (
    <Card emphasis={emphasis}>
      <div className="text-xs text-ink-2">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${VALUE_TONE[tone]}`}>
        {value}
      </div>
      {detail ? <div className="mt-0.5 text-xs text-ink-3">{detail}</div> : null}
    </Card>
  );
}

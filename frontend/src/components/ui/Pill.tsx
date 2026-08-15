import type { ReactNode } from 'react';

type Tone = 'default' | 'solid' | 'good' | 'warn' | 'risk';

const TONES: Record<Tone, string> = {
  default: 'border-line-strong text-ink-2',
  solid: 'border-solid-bg bg-solid-bg text-solid-ink',
  good: 'border-good bg-good-bg text-good',
  warn: 'border-warn bg-warn-bg text-warn',
  risk: 'border-risk bg-risk-bg text-risk',
};

/** Small status label: an order stage, a budget state, a risk flag, a filter chip. */
export function Pill({ tone = 'default', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

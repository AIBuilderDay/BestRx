import type { CSSProperties, ReactNode } from 'react';

const STEP_S = 0.05;

/** Staggered entrance for detail-page sections — softer and slower than catalog cards. */
export function DetailReveal({
  children,
  step = 0,
  className = '',
}: {
  children: ReactNode;
  step?: number;
  className?: string;
}) {
  return (
    <div
      className={`animate-detail-in motion-reduce:animate-none ${className}`.trim()}
      style={{ animationDelay: `${step * STEP_S}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

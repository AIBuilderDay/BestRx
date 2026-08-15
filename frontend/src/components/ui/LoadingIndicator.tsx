/**
 * A spinner that stays hidden until a request has been running for a moment.
 *
 * Flashing a spinner for a request that resolves in 80ms reads as a glitch, so nothing renders
 * until `delayMs` has passed. Most local API calls finish before it ever appears.
 */

import { useEffect, useState } from 'react';

/** Below this, a request feels instant and a spinner would only flicker. */
const DEFAULT_DELAY_MS = 1000;

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-ink-3 motion-reduce:animate-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LoadingIndicator({
  label = 'Loading…',
  delayMs = DEFAULT_DELAY_MS,
}: {
  label?: string;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  // aria-busy stays on the live region so a screen reader announces the wait even while the
  // spinner is still hidden.
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {visible && (
        <>
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-ink-3">{label}</p>
        </>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}

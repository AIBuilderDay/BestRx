/**
 * What a view shows when the API returns nothing, or nothing at all.
 *
 * The app has no fixture fallback: if a request fails, it fails visibly rather than quietly
 * rendering stale bundled data. These are the two faces of that — a failed request and a
 * successful one with an empty result, which are different problems and read differently.
 *
 * Tone follows docs/DESIGN_SYSTEM.html: plain, specific, respectful. Say what happened and what
 * the reader can do about it. No exclamation marks, no apology theatre.
 */

import type { ReactNode } from 'react';

function StateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">{children}</div>
    </div>
  );
}

/** Unplugged cable — the connection, not the data, is the problem. */
function ConnectionIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="mx-auto h-16 w-16 text-ink-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="20" width="20" height="24" rx="4" />
      <path d="M26 32h6" />
      <path d="M44 20v24a4 4 0 0 1-4 4h-2" opacity="0.4" />
      <path d="M38 32h6" strokeDasharray="3 4" opacity="0.5" />
      <path d="M44 24h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H44z" opacity="0.4" />
      <path d="M14 14v6M18 14v6" />
    </svg>
  );
}

/** An open box — the request worked, there is simply nothing in it. */
function EmptyBoxIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="mx-auto h-16 w-16 text-ink-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 24l8-10h32l8 10" />
      <path d="M8 24v22a2 2 0 0 0 2 2h44a2 2 0 0 0 2-2V24z" />
      <path d="M8 24h48" />
      <path d="M26 32h12" opacity="0.5" />
    </svg>
  );
}

export function ErrorState({
  title = 'Could not load this data',
  message,
  onRetry,
}: {
  title?: string;
  /** The underlying failure. Shown verbatim so a demo is honest about what broke. */
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <StateFrame>
      <ConnectionIcon />
      <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-2">
        The app could not reach the BestRx API. Nothing is shown rather than showing numbers that
        might be out of date.
      </p>
      {message && (
        <p className="mt-3 break-words rounded-control bg-bg-subtle px-3 py-2 text-left font-mono text-xs text-ink-3">
          {message}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-control bg-solid-bg px-4 py-2 text-sm font-medium text-solid-ink transition-opacity hover:opacity-90 motion-reduce:transition-none"
        >
          Try again
        </button>
      )}
    </StateFrame>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  message,
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <StateFrame>
      <EmptyBoxIcon />
      <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
      {message && <p className="mt-2 text-sm text-ink-2">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </StateFrame>
  );
}

import type { ReactNode } from 'react';

type Placement = 'top' | 'bottom' | 'left';

/**
 * Wraps an icon-only control with a label that appears instantly on hover or keyboard focus.
 * CSS-only (group-hover/group-focus-within) so there is no delay and no timer state to manage.
 * The trigger still needs its own aria-label — the tooltip is aria-hidden decoration.
 */
export function Tooltip({
  label,
  placement = 'bottom',
  hidden = false,
  className = '',
  children,
}: {
  label: string;
  placement?: Placement;
  /** Suppresses the tooltip — e.g. while the menu the trigger opens is showing. */
  hidden?: boolean;
  /** Layout classes for the wrapper, when the trigger's own sizing depends on its parent. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      {hidden ? null : (
        <span
          role="tooltip"
          aria-hidden
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-control bg-solid-bg px-2 py-1 text-[11px] leading-none text-solid-ink opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 ${PLACEMENT[placement]}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}

const PLACEMENT: Record<Placement, string> = {
  top: 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
  left: 'right-[calc(100%+6px)] top-1/2 -translate-y-1/2',
};

import type { ReactNode } from 'react';

/**
 * Scroll container for tables wider than the page.
 *
 * `contain-paint` is load-bearing, not decoration: without it the wide table's paint escapes the
 * rounded corners. `min-w-0` on the parent grid item is what keeps the page itself from scrolling
 * sideways instead of the table.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-card border border-line bg-surface contain-paint">
      {children}
    </div>
  );
}

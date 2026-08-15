import type { ReactNode } from 'react';

/** Breadcrumb, title, one-line subtitle, and an optional action on the right. */
export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  action,
}: {
  breadcrumb?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {breadcrumb ? <div className="mb-1.5 text-xs text-ink-3">{breadcrumb}</div> : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-[13px] text-ink-2">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

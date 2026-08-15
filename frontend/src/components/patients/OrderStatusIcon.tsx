import type { OrderDisplayIcon } from '../../lib/patients';

const strokeProps = {
  fill: 'none' as const,
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function OrderStatusIcon({ icon, className }: { icon: OrderDisplayIcon; className?: string }) {
  if (icon === 'late') {
    return (
      <span
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-[5px] bg-solid-bg ${className ?? ''}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-solid-ink" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.4 3.9 2.7 17.4A1.6 1.6 0 0 0 4.1 20h15.8a1.6 1.6 0 0 0 1.4-2.6L13.6 3.9a1.6 1.6 0 0 0-3.2 0z" />
          <path d="M12 9v4.5" />
          <path d="M12 16.8h.01" />
        </svg>
      </span>
    );
  }

  const muted = icon === 'picked_up';
  const stroke = muted ? 'var(--color-ink-3)' : 'var(--color-ink)';

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" className={`flex-none ${className ?? ''}`} {...strokeProps} stroke={stroke}>
      {icon === 'ordered' && (
        <>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1" />
          <path d="M9 10h6M9 14h4" />
        </>
      )}
      {icon === 'vendor_accepted' && (
        <>
          <path d="m16 16 2 2 4-4" />
          <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14M7.5 4.27l9 5.15" />
          <path d="M3.29 7 12 12l8.71-5M12 22V12" />
        </>
      )}
      {icon === 'in_transit' && (
        <>
          <path d="M2.5 7h11v9h-11z" />
          <path d="M13.5 10.5h4l3 3V16h-7" />
          <circle cx="6.5" cy="18" r="1.7" />
          <circle cx="17.5" cy="18" r="1.7" />
        </>
      )}
      {icon === 'delivered' && (
        <>
          <path d="M3.5 10.2 12 3.8l8.5 6.4V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
          <path d="M9.6 21v-6.2h4.8V21" />
        </>
      )}
      {icon === 'awaiting_pickup' && (
        <>
          <path d="M21 12.5V8.3a1.5 1.5 0 0 0-.75-1.3l-4.5-2.6a1.5 1.5 0 0 0-1.5 0l-4.5 2.6A1.5 1.5 0 0 0 9 8.3v5.2a1.5 1.5 0 0 0 .75 1.3l4.5 2.6a1.5 1.5 0 0 0 1.5 0l1.5-.87" />
          <path d="m9.5 7.2 5.5 3.2 5.5-3.2M15 16.8v-6.4" />
          <path d="M6 15 2 19l4 4" />
          <path d="M2 19h5.5" />
        </>
      )}
      {icon === 'picked_up' && (
        <>
          <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          <path d="m9 20-5-5 5-5" />
        </>
      )}
    </svg>
  );
}

import { useState, type ReactNode } from 'react';
import type { OrderListItemVM } from '../../lib/orders';
import { pillClasses } from '../../lib/patients';

export function OrderListSection({
  items,
  onCallVendor,
  onDownloadReceipt,
}: {
  items: OrderListItemVM[];
  onCallVendor: (item: OrderListItemVM) => void;
  onDownloadReceipt: (item: OrderListItemVM) => void;
}) {
  if (items.length === 0) {
    return <div className="py-6 text-[13px] text-ink-3">No orders match these filters.</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <OrderCard
          key={item.orderId}
          item={item}
          onCallVendor={onCallVendor}
          onDownloadReceipt={onDownloadReceipt}
        />
      ))}
    </div>
  );
}

function OrderCard({
  item,
  onCallVendor,
  onDownloadReceipt,
}: {
  item: OrderListItemVM;
  onCallVendor: (item: OrderListItemVM) => void;
  onDownloadReceipt: (item: OrderListItemVM) => void;
}) {
  return (
    <article className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <OrderCardImage imagePath={item.imagePath} name={item.name} />

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight">{item.name}</h3>
            <p className="mt-0.5 font-mono text-[13px] tabular-nums text-ink-3">{item.orderId}</p>

            <div className="mt-2 sm:hidden">
              <OrderStatusPill item={item} />
            </div>

            <dl className="mt-3.5 grid max-w-md grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="text-ink-3">Patient</dt>
              <dd>{item.patientName}</dd>
              <dt className="text-ink-3">Vendor</dt>
              <dd>{item.vendor}</dd>
              <dt className="text-ink-3">{item.whenLabel}</dt>
              <dd className="tabular-nums">{item.when}</dd>
            </dl>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:items-end">
            <div className="hidden sm:block">
              <OrderStatusPill item={item} className="sm:self-end" />
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <CardActionButton
                label="Call vendor"
                onClick={() => onCallVendor(item)}
                icon={<PhoneIcon />}
              />
              <CardActionButton
                label="Download receipt"
                onClick={() => onDownloadReceipt(item)}
                icon={<DownloadIcon />}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function OrderStatusPill({ item, className }: { item: OrderListItemVM; className?: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium whitespace-nowrap ${pillClasses(item.pillTone)} ${className ?? ''}`}
    >
      <span className="h-1.5 w-1.5 flex-none rounded-full bg-current opacity-80" aria-hidden />
      {item.statusLabel}
    </span>
  );
}

function CardActionButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex min-h-[38px] w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3.5 text-[13px] text-ink transition-colors hover:bg-hover sm:h-[38px] sm:w-[38px] sm:px-0"
    >
      {icon}
      <span className="sm:hidden">{label}</span>
    </button>
  );
}

function OrderCardImage({ imagePath, name }: { imagePath: string | null; name: string }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="flex h-28 shrink-0 items-center justify-center border-b border-line bg-bg-subtle sm:h-auto sm:w-[140px] sm:border-r sm:border-b-0">
      <div className="h-14 w-14 overflow-hidden">
        {imagePath && !broken ? (
          <img
            src={imagePath}
            alt=""
            onError={() => setBroken(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              backgroundImage: 'repeating-linear-gradient(135deg, var(--track) 0 6px, var(--hover) 6px 12px)',
            }}
            aria-hidden
          />
        )}
      </div>
      <span className="sr-only">{name}</span>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
      aria-hidden
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}

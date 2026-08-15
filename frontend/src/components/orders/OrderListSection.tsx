import { useState, type ReactNode } from 'react';
import type { OrderListItemVM } from '../../lib/orders';
import { pillClasses } from '../../lib/patients';
import { Tooltip } from '../ui/Tooltip';

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
    // Keying the list on its contents remounts the rows when filters, sort, or page change,
    // so the cascade replays instead of the new orders appearing all at once.
    <div key={items.map((item) => item.orderId).join()} className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <div
          key={item.orderId}
          className="animate-[cardIn_0.55s_cubic-bezier(0.2,0.7,0.2,1)_both]"
          style={{ animationDelay: `${i * 0.045}s` }}
        >
          <OrderCard
            item={item}
            onCallVendor={onCallVendor}
            onDownloadReceipt={onDownloadReceipt}
          />
        </div>
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
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-3 transition-colors hover:border-line-strong sm:grid sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <OrderCardImage imagePath={item.imagePath} name={item.name} />

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="text-[15px] font-semibold tracking-tight">{item.name}</h3>
          <span className="font-mono text-[12.5px] tabular-nums text-ink-3">{item.orderId}</span>
          <span className="rounded-[5px] border border-line px-1.5 text-[12.5px] tabular-nums text-ink-2">
            {item.qtyLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
          <MetaItem icon={<PersonIcon />} className="text-ink">
            {item.patientName}
          </MetaItem>
          <MetaItem icon={<StorefrontIcon />}>{item.vendor}</MetaItem>
          <MetaItem icon={<ClockIcon />}>
            <span className="tabular-nums">
              {item.whenLabel} {item.when}
            </span>
          </MetaItem>
          <MetaItem icon={<CalendarIcon />}>
            <span className="tabular-nums">Ordered {item.orderedAtLabel}</span>
          </MetaItem>
        </div>

        {item.address ? (
          <MetaItem icon={<LocationIcon />} className="min-w-0 text-[13px] text-ink-2">
            <span className="truncate">{item.address}</span>
          </MetaItem>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3.5 sm:justify-end">
        <div className="flex flex-col items-start gap-1.5 sm:w-[150px] sm:items-end">
          {/* Reserved whether or not this order can be priced, so the pill below keeps its line. */}
          <div className="flex min-h-[34px] flex-col items-start gap-1 sm:items-end">
            {item.price ? (
              <>
                <div className="text-[19px] leading-none font-bold tracking-tight tabular-nums">
                  {item.price.totalLabel}
                  {item.price.unit === '/mo' ? (
                    <span className="ml-1 text-[12px] font-normal text-ink-3">/mo</span>
                  ) : null}
                </div>
                <div className="text-[12px] tabular-nums text-ink-3">{item.price.unitLine}</div>
              </>
            ) : (
              // No offer row from this vendor for this equipment (or a rental/purchase mix
              // that cannot be summed). Shown blank rather than as a guessed figure.
              <span className="text-[15px] text-ink-3" title="No vendor price on file">
                —
              </span>
            )}
          </div>
          <OrderStatusPill item={item} />
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
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
    </article>
  );
}

function MetaItem({
  icon,
  children,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <span className="flex-none text-ink-3">{icon}</span>
      {children}
    </span>
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
    <Tooltip label={label} placement="left">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[8px] border border-line-strong bg-surface text-ink-2 transition-colors hover:bg-hover hover:text-ink"
      >
        {icon}
      </button>
    </Tooltip>
  );
}

function OrderCardImage({ imagePath, name }: { imagePath: string | null; name: string }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="h-28 w-full shrink-0 overflow-hidden rounded-[8px] border border-line bg-bg-subtle sm:h-[84px] sm:w-[84px]">
      {imagePath && !broken ? (
        <img
          src={imagePath}
          alt=""
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
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
      <span className="sr-only">{name}</span>
    </div>
  );
}

/** Shared frame for the small meta-row icons, matching the mock's 17px Material glyphs. */
function MetaIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="block"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function PersonIcon() {
  return (
    <MetaIcon>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </MetaIcon>
  );
}

function StorefrontIcon() {
  return (
    <MetaIcon>
      <path d="M4 4h16l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
      <path d="M5 11.5V20h14v-8.5" />
    </MetaIcon>
  );
}

function ClockIcon() {
  return (
    <MetaIcon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </MetaIcon>
  );
}

function CalendarIcon() {
  return (
    <MetaIcon>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
    </MetaIcon>
  );
}

function LocationIcon() {
  return (
    <MetaIcon>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </MetaIcon>
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

import { useState } from 'react';
import { moneyLabel } from '../../lib/catalog';
import { pillClasses } from '../../lib/patients';
import type { PatientEquipmentVM } from '../../lib/patients';
import { OrderStatusIcon } from './OrderStatusIcon';

function OrderCard({
  item,
  open,
  onToggle,
  onCallVendor,
  onViewInvoice,
}: {
  item: PatientEquipmentVM;
  open: boolean;
  onToggle: () => void;
  onCallVendor: (item: PatientEquipmentVM) => void;
  onViewInvoice: (item: PatientEquipmentVM) => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const showImage = item.thumbnailPath && !imgBroken;

  return (
    <div className="rounded-card border border-line transition-colors hover:border-line-strong">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-3.5 p-2.5 text-left text-ink"
      >
        <div className="h-20 w-20 flex-none overflow-hidden rounded-[7px] border border-line bg-bg-subtle">
          {showImage ? (
            <img
              src={item.thumbnailPath}
              alt=""
              onError={() => setImgBroken(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <OrderStatusIcon icon={item.icon} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[15px] font-semibold text-pretty">{item.name}</span>
          <span className="text-[13px] text-ink-2">{item.metaLine}</span>
        </div>

        {item.costPriced && item.costUsd > 0 ? (
          <div className="hidden flex-none flex-col items-end gap-0.5 sm:flex">
            <span className="text-[17px] font-bold tabular-nums">{moneyLabel(item.costUsd)}</span>
            <span className="text-[11px] text-ink-3">
              {item.costUnit === '/mo'
                ? 'per month'
                : item.costUnit === 'mixed'
                  ? 'mixed billing'
                  : 'one-time'}
            </span>
          </div>
        ) : null}

        <span
          className={`ml-auto inline-flex flex-none items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium sm:ml-0 ${pillClasses(item.pillTone)}`}
        >
          {item.statusLabel}
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-line px-2.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3.5 gap-y-1.5 text-xs">
            <span className="text-ink-3">Vendor</span>
            <span>{item.vendor}</span>
            <span className="text-ink-3">Vendor phone</span>
            <span className="tabular-nums">{item.phone}</span>
            <span className="text-ink-3">{item.whenLabel}</span>
            <span className="tabular-nums">{item.when}</span>
            <span className="text-ink-3">History</span>
            <span>{item.history}</span>
          </div>
          <div className="flex shrink-0 gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => onViewInvoice(item)}
              className="cursor-pointer rounded-control border border-line-strong bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors hover:bg-hover"
            >
              View invoice
            </button>
            <button
              type="button"
              onClick={() => onCallVendor(item)}
              className="cursor-pointer rounded-control border border-line-strong bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors hover:bg-hover"
            >
              Call vendor
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The patient's orders as thumbnail cards. Prices come from the vendor's offer rows — the same
 * source the invoice bills against — so a card and its receipt always agree.
 */
export function PatientOrderCards({
  equipment,
  costTotalUsd,
  costTotalUnit,
  costTotalPriced,
  onCallVendor,
  onViewInvoice,
}: {
  equipment: PatientEquipmentVM[];
  costTotalUsd: number;
  costTotalUnit: '/mo' | 'one-time' | 'mixed';
  costTotalPriced: boolean;
  onCallVendor: (item: PatientEquipmentVM) => void;
  onViewInvoice: (item: PatientEquipmentVM) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (equipment.length === 0) {
    return (
      <div className="rounded-card border border-line px-4 py-6 text-[13px] text-ink-3">
        No equipment orders on file for this patient.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Products ordered</h2>
        <span className="text-[13px] text-ink-3">
          {equipment.length} {equipment.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {equipment.map((item) => (
        <OrderCard
          key={item.orderId}
          item={item}
          open={openId === item.orderId}
          onToggle={() => setOpenId(openId === item.orderId ? null : item.orderId)}
          onCallVendor={onCallVendor}
          onViewInvoice={onViewInvoice}
        />
      ))}

      {costTotalUsd > 0 ? (
        <div className="flex justify-end pt-1 text-[13px] text-ink-2">
          <span>
            {costTotalPriced ? 'Total' : 'Total so far'}{' '}
            <span className="font-bold text-ink tabular-nums">
              {moneyLabel(costTotalUsd)}
              {costTotalUnit === '/mo' ? '/mo' : ''}
            </span>
            {costTotalUnit === 'mixed' ? ' (mixed billing)' : ''}
            {costTotalPriced ? '' : ' — some items unpriced'}
          </span>
        </div>
      ) : null}
    </div>
  );
}

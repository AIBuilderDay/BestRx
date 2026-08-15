import { useState } from 'react';
import type { PatientEquipmentVM } from '../../lib/patients';
import { pillClasses } from '../../lib/patients';
import { OrderStatusIcon } from './OrderStatusIcon';

export function ProductsOrderedSection({
  equipment,
  onCallVendor,
}: {
  equipment: PatientEquipmentVM[];
  onCallVendor: (item: PatientEquipmentVM) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-white">
      <div className="border-b border-[var(--color-line)] bg-[var(--color-bg-subtle)] px-4 py-3.5">
        <h2 className="text-[13px] font-semibold tracking-tight">Products ordered</h2>
      </div>

      {equipment.length === 0 ? (
        <div className="px-4 py-6 text-[13px] text-[var(--color-ink-3)]">No equipment orders on file for this patient.</div>
      ) : (
        <div className="flex flex-col">
          {equipment.map((item) => {
            const open = openId === item.orderId;
            return (
              <div key={item.orderId} className="border-b border-[var(--color-line)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : item.orderId)}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg-subtle)]"
                >
                  <OrderStatusIcon icon={item.icon} />
                  <span className="min-w-0 text-[13px] font-medium">{item.name}</span>
                  <span
                    className={`ml-auto inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${pillClasses(item.pillTone)}`}
                  >
                    {item.statusLabel}
                  </span>
                  <span className="w-2.5 flex-none text-right text-[11px] text-[var(--color-ink-3)]">
                    {open ? '▴' : '▾'}
                  </span>
                </button>
                {open ? (
                  <div className="flex flex-col gap-4 px-4 pb-3.5 pl-11 sm:flex-row sm:items-center sm:justify-between">
                    <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3.5 gap-y-1.5 text-xs">
                      <span className="text-[var(--color-ink-3)]">Vendor</span>
                      <span>{item.vendor}</span>
                      <span className="text-[var(--color-ink-3)]">Vendor phone</span>
                      <span className="tabular-nums">{item.phone}</span>
                      <span className="text-[var(--color-ink-3)]">{item.whenLabel}</span>
                      <span className="tabular-nums">{item.when}</span>
                      <span className="text-[var(--color-ink-3)]">History</span>
                      <span>{item.history}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCallVendor(item)}
                      className="shrink-0 cursor-pointer self-end rounded-[7px] border border-[var(--color-line-strong)] bg-white px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors hover:bg-[var(--color-hover)] sm:self-center"
                    >
                      Call vendor
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

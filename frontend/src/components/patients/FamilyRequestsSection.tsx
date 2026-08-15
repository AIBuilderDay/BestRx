import { useMemo, useSyncExternalStore } from 'react';
import {
  getPurchaseRequestsSnapshot,
  subscribePurchaseRequests,
} from '../../lib/purchaseRequests';

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/**
 * Open equipment requests a family member sent from the storefront. Read-only here — staff act on
 * them through the normal order flow; this just surfaces that a family asked. Renders nothing when
 * there are no open requests, so it stays out of the way on most charts.
 */
export function FamilyRequestsSection({ patientId }: { patientId: string }) {
  const all = useSyncExternalStore(subscribePurchaseRequests, getPurchaseRequestsSnapshot);
  const requests = useMemo(
    () => all.filter((r) => r.patientId === patientId && r.status === 'open'),
    [all, patientId],
  );

  if (requests.length === 0) return null;

  return (
    <section className="rounded-[10px] border border-solid-bg bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight">Family requests</h2>
        <span className="rounded-full border border-solid-bg bg-solid-bg px-2 py-0.5 text-[11px] font-medium text-solid-ink">
          {requests.length}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5 first:pt-0 last:pb-0">
            <span className="text-[13px] font-medium">
              {r.productName}
              {r.qty > 1 ? ` ×${r.qty}` : ''}
            </span>
            <span className="text-[12px] text-ink-3">requested by {r.familyMemberName}</span>
            <span className="ml-auto text-[12px] text-ink-3">{DATE_FMT.format(new Date(r.requestedAt))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

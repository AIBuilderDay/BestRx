import { TableWrap } from '../ui/TableWrap';
import type { Vendor } from '../../types/domain';

/**
 * Vendor directory for the Budget configuration tab: name, id, the hospice-wide scorecard rating,
 * and a session-only on/off switch. Nothing here is saved to the server — see AccountsBudgetTable
 * for the same rule on budget amounts.
 */
export function VendorStatusTable({
  vendors,
  enabled,
  canEdit,
  onToggle,
}: {
  vendors: Vendor[];
  enabled: Record<string, boolean>;
  canEdit: boolean;
  onToggle: (vendorId: string) => void;
}) {
  return (
    <section className="mt-5">
      <h2 className="text-[15px] text-ink">Vendors</h2>
      <p className="mt-1 text-[12px] text-ink-3">
        {canEdit
          ? 'Turn a vendor off to exclude it from consideration this session.'
          : 'View only — only the owner account can change vendor status.'}
      </p>

      <div className="mt-3">
        <TableWrap>
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <caption className="sr-only">
              Vendor directory: name, vendor id, scorecard rating, and whether it is active.
            </caption>
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                  Vendor
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                  Vendor ID
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3">
                  Rating
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => {
                const isOn = enabled[vendor.id] ?? true;
                return (
                  <tr key={vendor.id} className="border-t border-line">
                    <td className="px-3 py-2.5 text-ink">{vendor.displayName}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-ink-3">{vendor.id}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      ★ {vendor.overallRating.toFixed(1)}{' '}
                      <span className="text-ink-3">({vendor.overallRatingCount})</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        aria-label={`${isOn ? 'Disable' : 'Enable'} ${vendor.displayName}`}
                        disabled={!canEdit}
                        onClick={() => onToggle(vendor.id)}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
                          isOn ? 'border-ink bg-solid-bg' : 'border-line-strong bg-track'
                        } ${canEdit ? '' : 'cursor-default opacity-60'}`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-surface shadow-sm transition-transform ${
                            isOn ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </section>
  );
}

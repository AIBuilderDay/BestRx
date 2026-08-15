import { moneyCents, moneyLabel } from '../../lib/catalog';
import type { BasketLine, VendorColumn } from '../../lib/costLedger';
import { Sparkline } from '../ui/Sparkline';

const CELL = 'px-3 py-2.5 text-right tabular-nums';

/** One HCPCS code: what it cost, and what the contracted vendor charges for it. */
export function VendorPriceRow({
  line,
  columns,
  isOpen,
  onOpen,
}: {
  line: BasketLine;
  columns: VendorColumn[];
  isOpen: boolean;
  onOpen: () => void;
}) {
  const visibleColumns = columns.filter((c) => c.contracted);

  return (
    <tr
      tabIndex={0}
      aria-expanded={isOpen}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer border-t border-line"
    >
      <td className="px-3 py-2.5 font-mono text-[12px] group-hover:bg-hover">{line.hcpcs}</td>
      <td className="px-3 py-2.5 group-hover:bg-hover">
        <div className="text-ink">{line.name}</div>
        <div className="text-[12px] text-ink-3">
          {line.categoryLabel} · {line.kind === 'rental' ? 'monthly rental' : 'one-time'}
        </div>
      </td>
      <td className={`${CELL} group-hover:bg-hover`}>{line.units}</td>
      <td className={`${CELL} group-hover:bg-hover`}>{moneyLabel(line.actualUsd)}</td>

      {visibleColumns.map((column) => {
        const cell = line.prices.find((p) => p.vendorId === column.vendor.id);
        return (
          <td key={column.vendor.id} className={`${CELL} bg-bg-subtle border-x border-ink`}>
            {cell?.unitUsd === null || cell === undefined ? (
              <span className="text-ink-3">—</span>
            ) : (
              <>
                <div>{moneyCents(cell.unitUsd)}</div>
                <div className="text-[12px] opacity-70">{moneyLabel(cell.extendedUsd ?? 0)}</div>
              </>
            )}
          </td>
        );
      })}

      <td className={`${CELL} group-hover:bg-hover`}>
        <Sparkline values={line.weeklyActualUsd} label={`${line.hcpcs} spend trend`} />
      </td>
    </tr>
  );
}

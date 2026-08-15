import { moneyCents, moneyLabel } from '../../lib/catalog';
import type { BasketLine, VendorColumn } from '../../lib/costLedger';
import { Sparkline } from '../ui/Sparkline';

const CELL = 'px-3 py-2.5 text-right tabular-nums';

/** One HCPCS code: what it cost, and what it would have cost at each vendor. */
export function VendorPriceRow({
  line,
  columns,
  compareEnabled,
  isOpen,
  onOpen,
}: {
  line: BasketLine;
  columns: VendorColumn[];
  compareEnabled: boolean;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const visibleColumns = compareEnabled ? columns : columns.filter((c) => c.contracted);
  const delta = line.qualifiedDeltaUsd;

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
        const isBest = column.vendor.id === line.bestQualifiedVendorId;
        const isCheapestUnqualified =
          !column.qualified &&
          !column.contracted &&
          cell?.extendedUsd !== null &&
          cell?.extendedUsd === Math.min(...line.prices.map((p) => p.extendedUsd ?? Infinity));

        const tint = column.contracted
          ? 'bg-bg-subtle border-x border-ink'
          : isBest
            ? 'bg-good-bg text-good font-medium'
            : isCheapestUnqualified
              ? 'bg-warn-bg text-warn'
              : 'group-hover:bg-hover';

        return (
          <td key={column.vendor.id} className={`${CELL} ${tint}`}>
            {cell?.unitUsd === null || cell === undefined ? (
              <span className="text-ink-3">—</span>
            ) : (
              <>
                <div>{moneyCents(cell.unitUsd)}</div>
                <div className="text-[12px] opacity-70">{moneyLabel(cell.extendedUsd ?? 0)}</div>
                {isCheapestUnqualified ? <span className="sr-only">below the service floor</span> : null}
              </>
            )}
          </td>
        );
      })}

      <td className={`${CELL} group-hover:bg-hover`}>
        <Sparkline values={line.weeklyActualUsd} label={`${line.hcpcs} spend trend`} />
      </td>

      {compareEnabled ? (
        <td className={`${CELL} group-hover:bg-hover`}>
          {delta === null ? (
            <span className="text-ink-3">—</span>
          ) : Math.abs(delta) < 1 ? (
            <span className="text-ink-3">—</span>
          ) : delta > 0 ? (
            <span className="font-medium text-good">↓ {moneyLabel(delta)}</span>
          ) : (
            <span className="text-ink-2">+{moneyLabel(Math.abs(delta))}</span>
          )}
        </td>
      ) : null}
    </tr>
  );
}

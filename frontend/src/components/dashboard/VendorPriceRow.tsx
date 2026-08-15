import { moneyLabel } from '../../lib/catalog';
import type { BasketLine } from '../../lib/costLedger';
import { Sparkline } from '../ui/Sparkline';

const CELL = 'px-4 py-2.5 text-right tabular-nums';
const TREND_CELL = 'px-4 py-2.5 text-center';

/** One HCPCS code: what the hospice actually paid this period. */
export function VendorPriceRow({
  line,
  isOpen,
  onOpen,
}: {
  line: BasketLine;
  isOpen: boolean;
  onOpen: () => void;
}) {
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
      <td className="px-4 py-2.5 font-mono text-[12px] group-hover:bg-hover">{line.hcpcs}</td>
      <td className="px-4 py-2.5 group-hover:bg-hover">
        <div className="truncate text-ink">{line.name}</div>
        <div className="text-[12px] text-ink-3">
          {line.categoryLabel} · {line.kind === 'rental' ? 'monthly rental' : 'one-time'}
        </div>
      </td>
      <td className={`${CELL} group-hover:bg-hover`}>{line.units}</td>
      <td className={`${CELL} group-hover:bg-hover`}>{moneyLabel(line.actualUsd)}</td>
      <td className={`${TREND_CELL} group-hover:bg-hover`}>
        <Sparkline values={line.weeklyActualUsd} label={`${line.hcpcs} weekly spend trend`} />
      </td>
    </tr>
  );
}

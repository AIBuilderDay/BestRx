import { moneyLabel } from '../../lib/catalog';
import type { BasketLine } from '../../lib/costLedger';
import { Sparkline } from '../ui/Sparkline';

const CELL = 'px-4 py-2.5 text-right tabular-nums';
const TREND_CELL = 'px-4 py-2.5 text-center';

const trendCellClass = (values: number[]): string => {
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;

  if (last > first) return 'bg-good-bg text-good group-hover:bg-good-bg';
  if (last < first) return 'bg-risk-bg text-risk group-hover:bg-risk-bg';
  return 'group-hover:bg-hover';
};

/** One HCPCS code: what the hospice actually paid this period. */
export function VendorPriceRow({
  line,
  trendValues,
  isOpen,
  onOpen,
}: {
  line: BasketLine;
  trendValues: number[];
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
      <td className={`${TREND_CELL} ${trendCellClass(trendValues)}`}>
        <Sparkline values={trendValues} label={`${line.hcpcs} weekly order trend`} />
      </td>
    </tr>
  );
}

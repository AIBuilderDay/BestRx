import { useState } from 'react';
import type { CartLineVM } from '../../lib/catalog';
import { cartLineTiming, moneyCents } from '../../lib/catalog';
import type { Patient } from '../../types/domain';

/** One equipment line on the full cart page: image, item facts, delivery-vs-discharge check, controls. */
const REMOVE_MS = 260;

export function CartLineRow({
  line,
  patient,
  delayMs = 0,
  onQtyChange,
  onRemove,
}: {
  line: CartLineVM;
  patient: Patient | undefined;
  /** Entrance delay, set by the list so rows trickle in after their patient header. */
  delayMs?: number;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timing = patient ? cartLineTiming(patient, line.leadDays, line.priceUnit) : null;

  // Play the collapse-out first, then drop the line from the cart so the row is not yanked mid-animation.
  const remove = () => {
    setLeaving(true);
    window.setTimeout(onRemove, REMOVE_MS);
  };

  return (
    <div
      style={
        leaving
          ? { animation: `lineOut ${REMOVE_MS}ms cubic-bezier(0.4, 0, 1, 1) both` }
          : { animation: 'lineIn 0.4s cubic-bezier(0.2,0.7,0.2,1) both', animationDelay: `${delayMs}ms` }
      }
      className="grid grid-cols-[84px_minmax(0,1fr)_auto] gap-4 overflow-hidden border-b border-line py-5 sm:gap-5"
    >
      <div className="aspect-[3/4] w-full overflow-hidden border border-line bg-bg-subtle">
        {!imgBroken ? (
          <img
            src={line.imagePath}
            alt=""
            onError={() => setImgBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center font-mono text-[10px] text-ink-3">{line.hcpcs}</div>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-[15px] leading-snug">{line.name}</div>
        <div className="mt-1 text-xs text-ink-3">
          {line.hcpcs} · {line.categoryLabel} · {line.vendorNote}
        </div>
        {timing && (
          <div className={`mt-2.5 text-xs ${timing.missesDischarge ? 'text-risk' : 'text-ink-2'}`}>
            {timing.text}
          </div>
        )}
        {line.dupe && <div className="mt-1 text-xs text-ink">{patient?.firstName ?? 'Patient'} already has this item</div>}

        <div className="mt-3.5 flex items-center gap-4">
          <span className="flex items-center border border-line-strong transition-colors hover:border-ink">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => onQtyChange(line.qty - 1)}
              className="h-7 w-7 leading-none transition-colors hover:bg-solid-bg hover:text-solid-ink"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={99}
              value={line.qty}
              onChange={(e) => onQtyChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
              aria-label="Quantity"
              className="quantity-input w-8 border-0 bg-transparent text-center font-mono text-[12.5px] tabular-nums focus:bg-hover focus:outline-none"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => onQtyChange(line.qty + 1)}
              className="h-7 w-7 leading-none transition-colors hover:bg-solid-bg hover:text-solid-ink"
            >
              +
            </button>
          </span>
          <button
            type="button"
            onClick={remove}
            className="text-xs text-ink-3 underline decoration-1 underline-offset-2 transition-colors hover:text-ink"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="whitespace-nowrap text-right font-mono text-sm tabular-nums">
        {moneyCents(line.lineTotal)}
        {line.priceUnit === '/mo' && <span className="text-ink-3">/mo</span>}
      </div>
    </div>
  );
}

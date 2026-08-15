import type { PriceUnit, PricingMode } from '../../lib/catalog';

/**
 * Rental-versus-purchase switch. The catalog header renders the page-level version, which sets what every
 * card shows; a card with both prices renders the compact version to override itself.
 */
export function PricingModeToggle({
  mode,
  onChange,
}: {
  mode: PricingMode;
  onChange: (next: PricingMode) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-[10px] border border-line-strong" role="group" aria-label="Pricing">
      <ToggleButton active={mode === 'rent'} onClick={() => onChange('rent')} label="Rental" hint="monthly" />
      <ToggleButton active={mode === 'buy'} onClick={() => onChange('buy')} label="Purchase" hint="one-time" />
    </div>
  );
}

/** The per-card override. Same choice, sized to sit under a price. */
export function UnitToggle({
  unit,
  onChange,
}: {
  unit: PriceUnit;
  onChange: (next: PriceUnit) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden border border-line" role="group" aria-label="Rental or purchase">
      <MiniButton active={unit === 'month'} onClick={() => onChange('month')} label="Rental" />
      <MiniButton active={unit === 'purchase'} onClick={() => onChange('purchase')} label="Purchase" />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer px-3 py-1.5 text-[13px] transition-colors ${
        active ? 'bg-solid-bg text-solid-ink' : 'bg-surface text-ink-2 hover:bg-hover'
      }`}
    >
      {label} <span className="text-[11px] opacity-70">{hint}</span>
    </button>
  );
}

function MiniButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={active}
      className={`cursor-pointer px-2 py-0.5 text-[11px] transition-colors ${
        active ? 'bg-solid-bg text-solid-ink' : 'bg-surface text-ink-3 hover:bg-hover'
      }`}
    >
      {label}
    </button>
  );
}

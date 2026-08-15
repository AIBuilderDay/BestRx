import { useEffect, useState } from 'react';
import type { Patient } from '../../types/domain';
import { moneyLabel, patientFullName, patientMeta, patientOwnsEquipment, type CatalogProductVM } from '../../lib/catalog';

function QuantityPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const step = (delta: number) => onChange(Math.max(1, Math.min(99, value + delta)));

  return (
    <div className="inline-flex items-center overflow-hidden border border-line-strong bg-surface">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => step(-1)}
        className="h-10 w-10 text-lg leading-none transition-colors hover:bg-solid-bg hover:text-solid-ink"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={99}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
        aria-label="Quantity"
        className="quantity-input w-12 border-0 bg-transparent text-center font-mono text-base tabular-nums focus:bg-surface focus:outline-none"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => step(1)}
        className="h-10 w-10 text-lg leading-none transition-colors hover:bg-solid-bg hover:text-solid-ink"
      >
        +
      </button>
    </div>
  );
}

/** Two-step modal: pick patient(s), then choose the quantity to add to the cart. */
export function PatientAssignSheet({
  product,
  patients,
  onClose,
  onConfirm,
}: {
  product: CatalogProductVM | null;
  patients: Patient[];
  onClose: () => void;
  onConfirm: (selectedPatientIds: string[], qty: number) => void;
}) {
  const [step, setStep] = useState<'patient' | 'quantity'>('patient');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product) return;
    setStep('patient');
    setSelected([]);
    setQuery('');
    setQty(1);
  }, [product?.offer.id]);

  if (!product) return null;

  const q = query.trim().toLowerCase();
  const filtered = patients.filter(
    (p) => !q || p.id.toLowerCase().includes(q) || patientMeta(p).toLowerCase().includes(q) || patientFullName(p).toLowerCase().includes(q),
  );
  const dupes = selected.filter((pid) => patientOwnsEquipment(pid, product.offer.hcpcs));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const selectedPatients = selected
    .map((id) => patients.find((p) => p.id === id))
    .filter((p): p is Patient => Boolean(p));

  const continueToQuantity = () => {
    if (selected.length === 0) return;
    setQty(1);
    setStep('quantity');
  };

  const confirmLabel = selected.length > 1 ? `Add ${selected.length} lines to cart` : 'Add to cart';

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/20 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[470px] animate-sheet-in motion-reduce:animate-none border border-ink bg-surface p-5.5"
      >
        {step === 'patient' ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Who needs this equipment?
                </div>
                <div className="mt-1.5 text-[17px] tracking-tight">{product.offer.productName}</div>
                <div className="mt-0.5 text-xs text-ink-2">
                  {product.offer.hcpcs} · {product.vendor.displayName} · {moneyLabel(product.price.amount)}
                  {product.price.unit === '/mo' ? '/mo' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1 text-[15px] leading-none text-ink-3 transition-transform hover:rotate-90 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Search by patient or city"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="my-4 w-full border border-line bg-bg px-3 py-2.5 text-[13px] text-ink focus:border-ink focus:outline-none"
            />

            <div className="grid max-h-[264px] gap-0.5 overflow-y-auto">
              {filtered.map((p) => {
                const on = selected.includes(p.id);
                const owns = patientOwnsEquipment(p.id, product.offer.hcpcs);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 text-left transition-colors hover:bg-hover ${on ? 'bg-hover' : ''}`}
                  >
                    <span
                      className={`grid h-3.5 w-3.5 flex-none place-items-center border transition-colors ${
                        on ? 'border-solid-bg bg-solid-bg' : 'border-line-strong'
                      }`}
                    >
                      <span className={`text-[9px] leading-none text-solid-ink ${on ? 'scale-100' : 'scale-0'} transition-transform`}>✓</span>
                    </span>
                    <span className="grid min-w-0 gap-px">
                      <span className="font-mono text-[13px] tabular-nums">{patientFullName(p)}</span>
                      <span className="text-[11px] text-ink-3">{patientMeta(p)}</span>
                    </span>
                    {owns && (
                      <span className="ml-auto flex-none bg-solid-bg px-2 py-1 text-[8.5px] uppercase tracking-wide text-solid-ink">
                        Already has this item
                      </span>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-0.5 py-3.5 text-xs text-ink-3">No patients match that search.</div>
              )}
            </div>

            {dupes.length > 0 && (
              <div className="mt-3 animate-chip-in motion-reduce:animate-none border-l border-ink pl-2.5 text-xs">
                {dupes.length === 1
                  ? `${patientFullName(patients.find((p) => p.id === dupes[0])!)} already has this item — this will be an additional unit.`
                  : `${dupes.length} selected patients already have this item — these will be additional units.`}
              </div>
            )}

            <button
              type="button"
              onClick={continueToQuantity}
              disabled={selected.length === 0}
              className="mt-4 w-full border border-solid-bg bg-solid-bg py-3.5 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-ink-3">How many units?</div>
                <div className="mt-1.5 text-[17px] tracking-tight">{product.offer.productName}</div>
                <div className="mt-0.5 text-xs text-ink-2">
                  {selectedPatients.length === 1
                    ? `For ${patientFullName(selectedPatients[0])}`
                    : `For ${selectedPatients.length} patients · ${moneyLabel(product.price.amount * qty)} each`}
                  {product.price.unit === '/mo' ? '/mo' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1 text-[15px] leading-none text-ink-3 transition-transform hover:rotate-90 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="my-6 flex justify-center">
              <QuantityPicker value={qty} onChange={setQty} />
            </div>

            <div className="text-center text-xs text-ink-3">
              {moneyLabel(product.price.amount * qty)}
              {product.price.unit === '/mo' ? '/mo' : ''} per patient
              {selectedPatients.length > 1 ? ` · ${moneyLabel(product.price.amount * qty * selectedPatients.length)} total` : ''}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStep('patient')}
                className="border border-line-strong bg-surface py-3.5 text-[11px] uppercase tracking-[0.1em] text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => onConfirm(selected, qty)}
                className="border border-solid-bg bg-solid-bg py-3.5 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85"
              >
                {confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

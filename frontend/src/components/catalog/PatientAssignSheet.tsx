import { useState } from 'react';
import type { Patient } from '../../types/domain';
import { moneyLabel, patientFullName, patientMeta, patientOwnsEquipment, type CatalogProductVM } from '../../lib/catalog';

/** Modal for choosing which patient(s) a cart line is for. Purely presentational — all cart
 * mutation and validation (e.g. "pick at least one patient") lives in the Catalog view. */
export function PatientAssignSheet({
  product,
  qty,
  patients,
  checkoutAfter,
  onClose,
  onConfirm,
}: {
  product: CatalogProductVM | null;
  qty: number;
  patients: Patient[];
  checkoutAfter: boolean;
  onClose: () => void;
  onConfirm: (selectedPatientIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  if (!product) return null;

  const q = query.trim().toLowerCase();
  const filtered = patients.filter(
    (p) => !q || p.id.toLowerCase().includes(q) || patientMeta(p).toLowerCase().includes(q) || patientFullName(p).toLowerCase().includes(q),
  );
  const dupes = selected.filter((pid) => patientOwnsEquipment(pid, product.entry.hcpcs));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const confirmLabel =
    selected.length > 1 ? `Add ${selected.length} lines to cart` : checkoutAfter ? 'Add and review order' : 'Add to cart';

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/20 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[470px] animate-[sheetIn_0.45s_cubic-bezier(0.2,0.7,0.2,1)_both] rounded-2xl border border-[var(--color-ink)] bg-surface p-5.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
              Who needs this equipment?
            </div>
            <div className="mt-1.5 text-[17px] tracking-tight">
              {product.entry.name} × {qty}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-ink-2)]">
              {product.entry.hcpcs} · {moneyLabel(product.price.amount * qty)}
              {product.price.unit === '/mo' ? '/mo' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-[15px] leading-none text-[var(--color-ink-3)] transition-transform hover:rotate-90 hover:text-[var(--color-ink)]"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by patient or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="my-4 w-full rounded-lg border border-[var(--color-line)] bg-bg px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none"
        />

        <div className="grid max-h-[264px] gap-0.5 overflow-y-auto">
          {filtered.map((p) => {
            const on = selected.includes(p.id);
            const owns = patientOwnsEquipment(p.id, product.entry.hcpcs);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-hover ${on ? 'bg-hover' : ''}`}
              >
                <span
                  className={`grid h-3.5 w-3.5 flex-none place-items-center rounded-[3px] border transition-colors ${
                    on ? 'border-solid-bg bg-solid-bg' : 'border-[var(--color-line-strong)]'
                  }`}
                >
                  <span className={`text-[9px] leading-none text-solid-ink ${on ? 'scale-100' : 'scale-0'} transition-transform`}>✓</span>
                </span>
                <span className="grid min-w-0 gap-px">
                  <span className="font-mono text-[13px] tabular-nums">{patientFullName(p)}</span>
                  <span className="text-[11px] text-[var(--color-ink-3)]">{patientMeta(p)}</span>
                </span>
                {owns && (
                  <span className="ml-auto flex-none rounded-full bg-solid-bg px-2 py-1 text-[8.5px] uppercase tracking-wide text-solid-ink">
                    Already has this item
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-0.5 py-3.5 text-xs text-[var(--color-ink-3)]">No patients match that search.</div>
          )}
        </div>

        {dupes.length > 0 && (
          <div className="mt-3 animate-[chipIn_0.3s_cubic-bezier(0.2,0.7,0.2,1)_both] border-l border-[var(--color-ink)] pl-2.5 text-xs">
            {dupes.length === 1
              ? `${patientFullName(patients.find((p) => p.id === dupes[0])!)} already has this item — this will be an additional unit.`
              : `${dupes.length} selected patients already have this item — these will be additional units.`}
          </div>
        )}

        <button
          type="button"
          onClick={() => onConfirm(selected)}
          className="mt-4 w-full border border-solid-bg bg-solid-bg py-3.5 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

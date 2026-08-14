import { getAtRiskOrders, hospices, orders, vendors } from './data/db';

/**
 * Placeholder shell. It exists to prove the toolchain and the mock database are wired up, and to
 * give the first real ticket something to replace. Views belong in src/views/, not here.
 */
export default function App() {
  const atRisk = getAtRiskOrders();

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-semibold tracking-tight">BestRx</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-2)]">
        Shared DME visibility for hospices and vendors, order to pickup.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Orders" value={orders.length} />
        <Stat label="At risk" value={atRisk.length} />
        <Stat label="Hospices" value={hospices.length} />
        <Stat label="Vendors" value={vendors.length} />
      </dl>

      <p className="mt-8 text-sm text-[var(--color-ink-3)]">
        Scaffold only. Start from docs/PROJECT_DESCRIPTION.md, then your spec and ticket.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-4">
      <dt className="text-xs text-[var(--color-ink-2)]">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

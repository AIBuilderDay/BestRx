import { Button, PageHeader, Pill, Stat } from './components/ui';
import { getAtRiskOrders, hospices, orders, vendors } from './data/db';

/**
 * Placeholder shell. It exists to prove the toolchain and the mock database are wired up, and to
 * show the design-system primitives in use. The first real ticket replaces it — views belong in
 * src/views/.
 */
export default function App() {
  const atRisk = getAtRiskOrders();

  return (
    <main className="mx-auto max-w-4xl p-10">
      <PageHeader
        breadcrumb="Sample Hospice A"
        title="BestRx"
        subtitle="Amazon for DME vendors, for hospices. Order, track, and pick up in one place."
        action={<Button variant="primary">New order</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Orders" value={orders.length} detail="across every stage" />
        <Stat label="At risk" value={atRisk.length} detail="1 delivery · 1 pickup" emphasis />
        <Stat label="Hospices" value={hospices.length} />
        <Stat label="Vendors" value={vendors.length} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Pill tone="solid">Ordered</Pill>
        <Pill>In transit</Pill>
        <Pill tone="risk">At risk</Pill>
      </div>

      <p className="mt-8 text-[13px] text-ink-3">
        Scaffold only. Start from docs/PROJECT_DESCRIPTION.md and docs/DESIGN_SYSTEM.md, then your
        spec and ticket.
      </p>
    </main>
  );
}

import {
  buildOrderReceiptVM,
  linePriceLabel,
  lineTotalLabel,
  printOrderReceipt,
  receiptTotalLabel,
  type OrderReceiptVM,
} from '../../lib/orderReceipt';
/** Any view-model carrying an order id — the orders list and the patient page both qualify. */
export function OrderReceiptDialog({
  item,
  onClose,
}: {
  item: { orderId: string } | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const receipt = buildOrderReceiptVM(item.orderId);
  if (!receipt) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/30 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[520px] animate-sheet-in motion-reduce:animate-none flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-lg"
        role="dialog"
        aria-labelledby="order-receipt-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-ink-3">Receipt preview</div>
            <h2 id="order-receipt-title" className="mt-0.5 font-mono text-[15px] tabular-nums tracking-tight">
              {receipt.orderId}
            </h2>
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

        <div className="max-h-[min(70vh,640px)] overflow-y-auto bg-bg-subtle p-4 sm:p-5">
          <ReceiptDocument receipt={receipt} />
        </div>

        <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:gap-3 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-[13px] text-ink transition-colors hover:bg-hover"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => printOrderReceipt(receipt)}
            className="h-10 rounded-[10px] border border-solid-bg bg-solid-bg px-4 text-[13px] font-medium text-solid-ink transition-opacity hover:opacity-85"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptDocument({ receipt }: { receipt: OrderReceiptVM }) {
  return (
    <div className="mx-auto w-full max-w-[440px] bg-white px-6 py-7 text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-8 sm:py-8">
      <header className="border-b border-line pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">BestRx DME</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">Order receipt</h3>
        <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-3">
          {receipt.orderId} · {receipt.issuedAtLabel}
        </p>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-[13px]">
        <ReceiptField label="Hospice" value={receipt.hospiceName} />
        <ReceiptField label="Vendor" value={receipt.vendorName} />
        <ReceiptField label="Patient" value={receipt.patientName} sub={receipt.patientMrn} />
        <ReceiptField label="Status" value={receipt.statusLabel} />
      </div>

      <table className="mt-6 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.08em] text-ink-3">
            <th className="pb-2 pr-2 font-semibold">Item</th>
            <th className="pb-2 pr-2 text-right font-semibold">Qty</th>
            <th className="pb-2 pr-2 text-right font-semibold">Unit</th>
            <th className="pb-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((line) => (
            <tr key={line.hcpcs} className="border-b border-line/70">
              <td className="py-2.5 pr-2 align-top">
                <div className="font-medium">{line.name}</div>
                <div className="font-mono text-[11px] text-ink-3">{line.hcpcs}</div>
              </td>
              <td className="py-2.5 pr-2 text-right align-top font-mono tabular-nums">{line.qty}</td>
              <td className="py-2.5 pr-2 text-right align-top font-mono tabular-nums">
                {linePriceLabel(line)}
              </td>
              <td className="py-2.5 text-right align-top font-mono tabular-nums">
                {lineTotalLabel(line)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end border-t border-line pt-3">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.08em] text-ink-3">Total</div>
          <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">
            {receiptTotalLabel(receipt)}
          </div>
        </div>
      </div>

      <p className="mt-6 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-3">
        Demo receipt — amounts reflect catalog pricing at time of order.
      </p>
    </div>
  );
}

function ReceiptField({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-ink-3">{label}</div>
      <div className="mt-0.5">{value}</div>
      {sub ? <div className="font-mono text-[11px] text-ink-3">{sub}</div> : null}
    </div>
  );
}

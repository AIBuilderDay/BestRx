/**
 * Receipt view-model for order download preview. Prices come from vendor offers matched to the order.
 */

import { getHospice, getOrder, getPatient, getVendor, vendorOffers } from '../data/db';
import { moneyLabel, offerPrice, patientFullName } from './catalog';
import { buildOrderEquipmentVM } from './patients';

export interface OrderReceiptLine {
  hcpcs: string;
  name: string;
  qty: number;
  unitPriceUsd: number;
  unit: '/mo' | 'one-time';
  lineTotalUsd: number;
}

export interface OrderReceiptVM {
  orderId: string;
  issuedAtLabel: string;
  orderedAtLabel: string;
  patientName: string;
  patientMrn: string;
  vendorName: string;
  hospiceName: string;
  statusLabel: string;
  lines: OrderReceiptLine[];
  totalUsd: number;
  totalUnit: '/mo' | 'one-time' | 'mixed';
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// vendorId is nullable: an order can be placed before a vendor is assigned.
function findOfferPrice(
  vendorId: string | null,
  hcpcs: string,
): { amount: number; unit: '/mo' | 'one-time' } | null {
  if (!vendorId) return null;
  const offer = vendorOffers().find((o) => o.vendorId === vendorId && o.hcpcs === hcpcs);
  if (!offer) return null;
  const price = offerPrice(offer);
  if (!price) return null;
  return { amount: price.amount, unit: price.unit };
}

export function buildOrderReceiptVM(orderId: string): OrderReceiptVM | null {
  const order = getOrder(orderId);
  if (!order) return null;

  const patient = getPatient(order.patientId);
  const vendor = getVendor(order.vendorId);
  const hospice = getHospice(order.hospiceId);
  const base = buildOrderEquipmentVM(order);

  const lines: OrderReceiptLine[] = order.equipment.map((eq) => {
    const price = order.vendorId ? findOfferPrice(order.vendorId, eq.hcpcs) : null;
    const unitPriceUsd = price?.amount ?? 0;
    const unit = price?.unit ?? 'one-time';
    return {
      hcpcs: eq.hcpcs,
      name: eq.name,
      qty: eq.qty,
      unitPriceUsd,
      unit,
      lineTotalUsd: unitPriceUsd * eq.qty,
    };
  });

  const units = new Set(lines.map((l) => l.unit));
  let totalUnit: OrderReceiptVM['totalUnit'] = 'one-time';
  if (units.size > 1) totalUnit = 'mixed';
  else if (units.has('/mo')) totalUnit = '/mo';

  const totalUsd = lines.reduce((sum, l) => sum + l.lineTotalUsd, 0);

  return {
    orderId: order.id,
    issuedAtLabel: formatDate(order.orderedAt),
    orderedAtLabel: formatDate(order.orderedAt),
    patientName: patient ? patientFullName(patient) : '—',
    patientMrn: order.patientId,
    vendorName: vendor?.displayName ?? base.vendor,
    hospiceName: hospice?.name ?? '—',
    statusLabel: base.statusLabel,
    lines,
    totalUsd,
    totalUnit,
  };
}

export function receiptTotalLabel(receipt: OrderReceiptVM): string {
  const base = moneyLabel(receipt.totalUsd);
  if (receipt.totalUnit === '/mo') return `${base}/mo`;
  if (receipt.totalUnit === 'mixed') return `${base} (mixed billing)`;
  return base;
}

export function linePriceLabel(line: OrderReceiptLine): string {
  const base = moneyLabel(line.unitPriceUsd);
  return line.unit === '/mo' ? `${base}/mo` : base;
}

export function lineTotalLabel(line: OrderReceiptLine): string {
  const base = moneyLabel(line.lineTotalUsd);
  return line.unit === '/mo' ? `${base}/mo` : base;
}

/** Open a print-friendly window so the user can save as PDF. */
export function printOrderReceipt(receipt: OrderReceiptVM): void {
  const rows = receipt.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.name)}<br><span class="muted">${escapeHtml(line.hcpcs)}</span></td>
        <td class="num">${line.qty}</td>
        <td class="num">${escapeHtml(linePriceLabel(line))}</td>
        <td class="num">${escapeHtml(lineTotalLabel(line))}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(receipt.orderId)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 40px; font-size: 13px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.02em; }
    .meta { color: #555; font-size: 12px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 4px; text-align: left; vertical-align: top; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; font-weight: 600; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total { margin-top: 16px; text-align: right; font-size: 15px; font-weight: 600; }
    .muted { color: #666; font-size: 11px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
  </style>
</head>
<body>
  <h1>DME order receipt</h1>
  <div class="meta">Receipt # ${escapeHtml(receipt.orderId)} · Issued ${escapeHtml(receipt.issuedAtLabel)}</div>
  <div class="grid">
    <div>
      <div class="label">Hospice</div>
      <div>${escapeHtml(receipt.hospiceName)}</div>
    </div>
    <div>
      <div class="label">Vendor</div>
      <div>${escapeHtml(receipt.vendorName)}</div>
    </div>
    <div>
      <div class="label">Patient</div>
      <div>${escapeHtml(receipt.patientName)}<br><span class="muted">${escapeHtml(receipt.patientMrn)}</span></div>
    </div>
    <div>
      <div class="label">Status</div>
      <div>${escapeHtml(receipt.statusLabel)}</div>
    </div>
  </div>
  <div class="label">Line items</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Unit</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total: ${escapeHtml(receiptTotalLabel(receipt))}</div>
  <div class="footer">Demo receipt — amounts reflect catalog pricing at time of order.</div>
</body>
</html>`;

  // NB: no 'noopener' here — that flag makes window.open return null, so we'd never get a handle
  // to write the receipt into and the new tab would sit blank. We control this HTML, so it's safe.
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

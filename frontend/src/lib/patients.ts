/**
 * Pure helpers for the Patients list and detail views. All values derive from src/data/db.ts.
 */

import {
  getCatalogEntry,
  getOrderEvents,
  getOrdersForPatient,
  getPatient,
  getVendor,
  patients,
  vendorOffers,
} from '../data/db';
import type { Address, Order, OrderStatus, Patient } from '../types/domain';
import { offerPrice, patientFullName } from './catalog';

export type OrderDisplayIcon =
  | 'ordered'
  | 'vendor_accepted'
  | 'in_transit'
  | 'late'
  | 'delivered'
  | 'awaiting_pickup'
  | 'picked_up';

export type PillTone = 'warn' | 'done' | 'plain' | 'muted';

export interface PatientEquipmentVM {
  orderId: string;
  name: string;
  statusLabel: string;
  icon: OrderDisplayIcon;
  pillTone: PillTone;
  vendor: string;
  phone: string;
  whenLabel: string;
  when: string;
  history: string;
  /** First catalog image across the order's equipment, for the card thumbnail. */
  thumbnailPath?: string;
  /** Order cost from the vendor's offer rows — the figure the invoice bills. */
  costUsd: number;
  costUnit: '/mo' | 'one-time' | 'mixed';
  /** False when a line has no matching vendor offer, making the total incomplete. */
  costPriced: boolean;
  /** "DME-10361 · Vendor 3 · Qty 1" — the card's second line. */
  metaLine: string;
}

export interface PatientRailFact {
  key: string;
  /** Which MUI glyph the rail renders beside the value. */
  icon: 'dob' | 'gender' | 'diagnosis' | 'discharge' | 'address';
  lines: string[];
}

export interface PatientDetailVM {
  patient: Patient;
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  equipment: PatientEquipmentVM[];
  attentionCount: number;
  facts: { key: string; value: string }[];
  /** Icon-led identity facts for the left rail. */
  railFacts: PatientRailFact[];
  /** Header counts: open vs. delivered orders, and what those orders cost. */
  openOrders: number;
  deliveredOrders: number;
  /** Sum of every priced order. `costTotalPriced` is false when any order is missing an offer. */
  costTotalUsd: number;
  costTotalUnit: '/mo' | 'one-time' | 'mixed';
  costTotalPriced: boolean;
}

export function getCaseloadPatients(userId: string, hospiceId: string): Patient[] {
  return patients().filter(
    (p) => p.hospiceId === hospiceId && p.caseManagerId === userId && p.status !== 'deceased',
  );
}

export function isInCaseload(patientId: string, userId: string, hospiceId: string): boolean {
  return getCaseloadPatients(userId, hospiceId).some((p) => p.id === patientId);
}

export function patientAge(dob: string): number {
  const born = new Date(dob + 'T12:00:00');
  const now = new Date('2026-08-14T12:00:00');
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age--;
  return age;
}

export function formatDob(dob: string): string {
  const d = new Date(dob + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatPatientAddress(address: Address): { line1: string; line2: string } {
  const line1 = address.street2 ? `${address.street1}, ${address.street2}` : address.street1;
  const line2 = `${address.city}, ${address.state} ${address.zip}`;
  return { line1, line2 };
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function isLate(order: Order): boolean {
  if (order.riskState === 'at_risk') return true;
  if (order.eta && order.targetBy) {
    return new Date(order.eta) > new Date(order.targetBy);
  }
  return false;
}

function displayStatus(order: Order): { label: string; icon: OrderDisplayIcon; tone: PillTone } {
  if (order.status === 'ordered') {
    return { label: 'Ordered', icon: 'ordered', tone: 'plain' };
  }
  if (order.status === 'dispatched') {
    return { label: 'Vendor accepted', icon: 'vendor_accepted', tone: 'plain' };
  }
  if (order.status === 'in_transit') {
    if (isLate(order)) {
      const eta = order.eta ? formatDateTime(order.eta) : '';
      return { label: eta ? `Late — ETA ${eta.split(', ').pop()}` : 'Late', icon: 'late', tone: 'warn' };
    }
    return { label: 'In transit', icon: 'in_transit', tone: 'plain' };
  }
  if (order.status === 'delivered') {
    return { label: 'Delivered', icon: 'delivered', tone: 'done' };
  }
  if (order.status === 'pickup_triggered') {
    if (order.riskState === 'pickup_delayed') {
      return { label: 'Awaiting pickup', icon: 'awaiting_pickup', tone: 'warn' };
    }
    return { label: 'Awaiting pickup', icon: 'awaiting_pickup', tone: 'plain' };
  }
  if (order.status === 'picked_up') {
    return { label: 'Picked up', icon: 'picked_up', tone: 'muted' };
  }
  return { label: order.status, icon: 'ordered', tone: 'plain' };
}

function whenLabelFor(order: Order): string {
  if (order.status === 'pickup_triggered' || order.status === 'picked_up') return 'Pickup';
  if (order.status === 'delivered') return 'Delivered';
  return 'Expected';
}

function whenValueFor(order: Order): string {
  if (order.status === 'picked_up' && order.pickedUpAt) return formatDateTime(order.pickedUpAt);
  if (order.status === 'pickup_triggered' && order.pickupDueBy) return `Due ${formatDateTime(order.pickupDueBy)}`;
  if (order.status === 'delivered' && order.deliveredAt) return formatDateTime(order.deliveredAt);
  if (order.eta) return formatDateTime(order.eta);
  if (order.targetBy) return formatDateTime(order.targetBy);
  return '—';
}

function historyLine(order: Order): string {
  const events = getOrderEvents(order.id);
  const last = events[events.length - 1];
  if (last?.detail) return last.detail;
  if (order.notes) return order.notes;
  return '—';
}

function equipmentLabel(order: Order): string {
  return order.equipment.map((e) => `${e.hcpcs} ${e.name}`).join(' + ');
}

/** First catalog image across the order's lines. Undefined when no line has a catalog entry. */
function equipmentImage(order: Order): string | undefined {
  for (const line of order.equipment) {
    const image = getCatalogEntry(line.hcpcs)?.imagePath;
    if (image) return image;
  }
  return undefined;
}

/**
 * What this order costs, priced from the vendor's own offer rows — the same source the invoice
 * bills against, so the patient page and the receipt can never disagree. `priced` is false when a
 * line has no matching offer: the total is then incomplete and the UI shows no figure rather than
 * a short one. Rentals and purchases are kept apart; a mixed order reports 'mixed'.
 */
function orderCost(order: Order): {
  amount: number;
  unit: '/mo' | 'one-time' | 'mixed';
  priced: boolean;
} {
  let amount = 0;
  const units = new Set<'/mo' | 'one-time'>();
  let priced = order.equipment.length > 0;

  for (const line of order.equipment) {
    const offer = order.vendorId
      ? vendorOffers().find((o) => o.vendorId === order.vendorId && o.hcpcs === line.hcpcs)
      : undefined;
    const price = offer ? offerPrice(offer) : null;
    if (!price) {
      priced = false;
      continue;
    }
    amount += price.amount * (line.qty || 1);
    units.add(price.unit);
  }

  const unit = units.size > 1 ? 'mixed' : units.has('/mo') ? '/mo' : 'one-time';
  return { amount, unit, priced };
}

/** Shared order row display — used on patient detail and the orders list. */
export function buildOrderEquipmentVM(order: Order): PatientEquipmentVM {
  const vendor = getVendor(order.vendorId);
  const { label, icon, tone } = displayStatus(order);
  const cost = orderCost(order);
  const qty = order.equipment.reduce((sum, e) => sum + (e.qty || 1), 0);
  const metaParts = [order.id, vendor?.displayName ?? vendor?.name, `Qty ${qty}`].filter(Boolean);
  return {
    orderId: order.id,
    name: equipmentLabel(order),
    statusLabel: label,
    icon,
    pillTone: tone,
    vendor: vendor?.name ?? '—',
    phone: vendor?.contact.dispatchPhone ?? '—',
    whenLabel: whenLabelFor(order),
    when: whenValueFor(order),
    history: historyLine(order),
    thumbnailPath: equipmentImage(order),
    costUsd: cost.amount,
    costUnit: cost.unit,
    costPriced: cost.priced,
    metaLine: metaParts.join(' · '),
  };
}

export function patientAttentionCount(patientOrders: Order[]): number {
  return patientOrders.filter((o) => o.riskState !== null).length;
}

function buildPatientFacts(patient: Patient): { key: string; value: string }[] {
  const age = patientAge(patient.dob);
  const facts: { key: string; value: string }[] = [
    { key: 'MRN', value: patient.id },
    { key: 'Date of birth', value: `${formatDob(patient.dob)} (${age})` },
    { key: 'Diagnosis', value: patient.primaryDiagnosis.description },
    {
      key: 'Gender',
      value: patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender,
    },
  ];
  if (patient.dischargeAt) {
    facts.push({ key: 'Hospital discharge', value: formatDateTime(patient.dischargeAt) });
  }
  return facts;
}

/** The rail's icon-led identity list. Optional facts are omitted rather than rendered empty. */
function buildRailFacts(patient: Patient, addr: { line1: string; line2: string }): PatientRailFact[] {
  const gender =
    patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender;
  const railFacts: PatientRailFact[] = [
    {
      key: 'Date of birth',
      icon: 'dob',
      lines: [`${formatDob(patient.dob)} · ${patientAge(patient.dob)}`],
    },
    { key: 'Gender', icon: 'gender', lines: [gender] },
    { key: 'Diagnosis', icon: 'diagnosis', lines: [patient.primaryDiagnosis.description] },
  ];
  if (patient.dischargeAt) {
    railFacts.push({
      key: 'Hospital discharge',
      icon: 'discharge',
      lines: [`Discharge ${formatDateTime(patient.dischargeAt)}`],
    });
  }
  railFacts.push({ key: 'Address', icon: 'address', lines: [addr.line1, addr.line2] });
  return railFacts;
}

const OPEN_STATUSES: OrderStatus[] = ['ordered', 'dispatched', 'in_transit', 'pickup_triggered'];

/** Roll the per-order costs up for the header. Any unpriced order makes the whole total partial. */
function costTotals(equipment: PatientEquipmentVM[]): {
  costTotalUsd: number;
  costTotalUnit: '/mo' | 'one-time' | 'mixed';
  costTotalPriced: boolean;
} {
  const units = new Set(equipment.filter((e) => e.costUsd > 0).map((e) => e.costUnit));
  return {
    costTotalUsd: equipment.reduce((sum, e) => sum + e.costUsd, 0),
    costTotalUnit: units.size > 1 ? 'mixed' : units.has('/mo') ? '/mo' : 'one-time',
    costTotalPriced: equipment.every((e) => e.costPriced),
  };
}

export function buildPatientDetailVM(patientId: string): PatientDetailVM | null {
  const patient = getPatient(patientId);
  if (!patient) return null;

  const patientOrders = getOrdersForPatient(patientId);
  const fullName = patientFullName(patient);
  const addr = formatPatientAddress(patient.address);
  const equipment = patientOrders.map(buildOrderEquipmentVM);

  return {
    patient,
    fullName,
    addressLine1: addr.line1,
    addressLine2: addr.line2,
    equipment,
    attentionCount: patientAttentionCount(patientOrders),
    facts: buildPatientFacts(patient),
    railFacts: buildRailFacts(patient, addr),
    openOrders: patientOrders.filter((o) => OPEN_STATUSES.includes(o.status)).length,
    deliveredOrders: patientOrders.filter((o) => o.status === 'delivered').length,
    ...costTotals(equipment),
  };
}

export function caseloadSubtitle(caseload: Patient[], attentionTotal: number): string {
  const n = caseload.length;
  const patientWord = n === 1 ? 'patient' : 'patients';
  if (attentionTotal === 0) {
    return `${n} ${patientWord} assigned to you`;
  }
  const needWord = attentionTotal === 1 ? 'needs' : 'need';
  return `${n} ${patientWord} assigned to you · ${attentionTotal} ${needWord} attention today`;
}

export function caseloadAttentionTotal(caseload: Patient[]): number {
  return caseload.reduce((sum, p) => sum + patientAttentionCount(getOrdersForPatient(p.id)), 0);
}

export function filterCaseload(caseload: Patient[], query: string): Patient[] {
  const q = query.trim().toLowerCase();
  if (!q) return caseload;
  return caseload.filter(
    (p) => patientFullName(p).toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
  );
}

export function pillClasses(tone: PillTone): string {
  switch (tone) {
    case 'warn':
      return 'border-solid-bg bg-solid-bg text-solid-ink';
    case 'muted':
      return 'border-line bg-bg-subtle text-ink-3';
    case 'done':
    case 'plain':
    default:
      return 'border-line-strong bg-surface text-ink-2';
  }
}

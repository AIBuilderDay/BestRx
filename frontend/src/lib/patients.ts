/**
 * Pure helpers for the Patients list and detail views. All values derive from src/data/db.ts.
 */

import { getOrderEvents, getOrdersForPatient, getPatient, getVendor, patients } from '../data/db';
import type { Address, Order, Patient } from '../types/domain';
import { patientFullName } from './catalog';

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
}

export interface PatientDetailVM {
  patient: Patient;
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  equipment: PatientEquipmentVM[];
  attentionCount: number;
  facts: { key: string; value: string }[];
}

export function getCaseloadPatients(userId: string, hospiceId: string): Patient[] {
  return patients.filter(
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

function buildEquipmentVM(order: Order): PatientEquipmentVM {
  const vendor = getVendor(order.vendorId);
  const { label, icon, tone } = displayStatus(order);
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

export function buildPatientDetailVM(patientId: string): PatientDetailVM | null {
  const patient = getPatient(patientId);
  if (!patient) return null;

  const patientOrders = getOrdersForPatient(patientId);
  const fullName = patientFullName(patient);
  const addr = formatPatientAddress(patient.address);

  return {
    patient,
    fullName,
    addressLine1: addr.line1,
    addressLine2: addr.line2,
    equipment: patientOrders.map(buildEquipmentVM),
    attentionCount: patientAttentionCount(patientOrders),
    facts: buildPatientFacts(patient),
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
      return 'border-[var(--color-line)] bg-[var(--color-bg-subtle)] text-[var(--color-ink-3)]';
    case 'done':
    case 'plain':
    default:
      return 'border-[var(--color-line-strong)] bg-surface text-[var(--color-ink-2)]';
  }
}

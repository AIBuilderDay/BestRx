/**
 * Runtime store for family purchase requests — a family member asking the hospice to send a piece
 * of equipment rather than buying it themselves. Mirrors the familyMembers store: seed + localStorage
 * additions, with a useSyncExternalStore-friendly subscribe/snapshot pair. Frontend-only for now;
 * the real request would post to the backend.
 */

import type { FamilyPurchaseRequest } from '../types/domain';

// One seeded request so a staff demo account sees the section populated. PT-88601 is on Dana's
// (USR-001) caseload and FAM-001 (Grace Nguyen) is that patient's daughter.
const seed: FamilyPurchaseRequest[] = [
  {
    id: 'REQ-001',
    patientId: 'PT-88601',
    familyMemberId: 'FAM-001',
    familyMemberName: 'Grace Nguyen',
    offerId: 'OFR-006',
    productName: 'Commode Chair',
    qty: 1,
    requestedAt: '2026-08-14T17:40:00Z',
    status: 'open',
  },
];

const STORAGE_KEY = 'bestrx.purchaseRequests';

function readAdded(): FamilyPurchaseRequest[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FamilyPurchaseRequest[]) : [];
  } catch {
    return [];
  }
}

function writeAdded(added: FamilyPurchaseRequest[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(added));
  } catch {
    // Persistence unavailable: requests live only for this session.
  }
}

let current: FamilyPurchaseRequest[] = [...seed, ...readAdded()];

const listeners = new Set<() => void>();
const emit = (): void => {
  for (const fn of listeners) fn();
};

export function subscribePurchaseRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPurchaseRequestsSnapshot(): FamilyPurchaseRequest[] {
  return current;
}

export function getOpenRequestsForPatient(patientId: string): FamilyPurchaseRequest[] {
  return current.filter((r) => r.patientId === patientId && r.status === 'open');
}

function nextRequestId(): string {
  const max = current.reduce((n, r) => {
    const parsed = Number.parseInt(r.id.replace(/\D/g, ''), 10);
    return Number.isNaN(parsed) ? n : Math.max(n, parsed);
  }, 0);
  return `REQ-${String(max + 1).padStart(3, '0')}`;
}

export interface NewPurchaseRequest {
  patientId: string;
  familyMemberId: string;
  familyMemberName: string;
  offerId: string;
  productName: string;
  qty: number;
}

export function addPurchaseRequest(input: NewPurchaseRequest): FamilyPurchaseRequest {
  const request: FamilyPurchaseRequest = {
    id: nextRequestId(),
    ...input,
    requestedAt: new Date().toISOString(),
    status: 'open',
  };
  current = [...current, request];
  writeAdded(current.filter((r) => !seed.some((s) => s.id === r.id)));
  emit();
  return request;
}

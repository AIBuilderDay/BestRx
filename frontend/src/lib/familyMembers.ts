/**
 * Runtime store for patient family members.
 *
 * Unlike the frozen JSON "tables" in src/data, this list is mutated live: staff add relatives from
 * the patient chart, and those additions must survive a sign-out so the new person can sign in as a
 * family member. So the store seeds from family_members.json and layers localStorage-persisted
 * additions on top. It exposes a useSyncExternalStore-friendly subscribe/snapshot pair.
 *
 * These contacts are the audience for the delivery notifications (SQS/messaging) to come.
 */

import seedJson from '../data/family_members.json';
import { getPatient } from '../data/db';
import type { FamilyMember, User } from '../types/domain';

const seed = seedJson as unknown as FamilyMember[];

const STORAGE_KEY = 'bestrx.familyMembers';

/** Additions made in this browser, read from localStorage (empty if unavailable). */
function readAdded(): FamilyMember[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FamilyMember[]) : [];
  } catch {
    return [];
  }
}

function writeAdded(added: FamilyMember[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(added));
  } catch {
    // Persistence unavailable (private mode): additions live only for this session.
  }
}

// Seeds first, then live additions. `current` is only replaced on mutation, so useSyncExternalStore
// sees a stable reference between changes.
let current: FamilyMember[] = [...seed, ...readAdded()];

const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function subscribeFamilyMembers(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFamilyMembersSnapshot(): FamilyMember[] {
  return current;
}

export function getFamilyForPatient(patientId: string): FamilyMember[] {
  return current.filter((f) => f.patientId === patientId);
}

export function findFamilyMemberByEmail(email: string): FamilyMember | undefined {
  const needle = email.trim().toLowerCase();
  return needle === '' ? undefined : current.find((f) => f.email.toLowerCase() === needle);
}

export function getFamilyMember(id: string | null | undefined): FamilyMember | undefined {
  return id ? current.find((f) => f.id === id) : undefined;
}

/** Generate the next FAM-### id above whatever is already stored. */
function nextFamilyId(): string {
  const max = current.reduce((n, f) => {
    const parsed = Number.parseInt(f.id.replace(/\D/g, ''), 10);
    return Number.isNaN(parsed) ? n : Math.max(n, parsed);
  }, 0);
  return `FAM-${String(max + 1).padStart(3, '0')}`;
}

export interface NewFamilyMember {
  patientId: string;
  name: string;
  relationship: string;
  email: string;
  phone: string;
  notify: boolean;
}

export function addFamilyMember(input: NewFamilyMember): FamilyMember {
  const member: FamilyMember = {
    id: nextFamilyId(),
    patientId: input.patientId,
    name: input.name.trim(),
    relationship: input.relationship.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    notify: input.notify,
    addedAt: new Date().toISOString(),
  };
  current = [...current, member];
  // Persist only the additions, never the seeds.
  writeAdded(current.filter((f) => !seed.some((s) => s.id === f.id)));
  emit();
  return member;
}

/**
 * A family login is not a hospice/vendor staff account, so we synthesize a User for the session
 * from the FamilyMember and their patient's hospice. Returns undefined if the patient is gone.
 */
export function familyMemberToUser(member: FamilyMember): User | undefined {
  const patient = getPatient(member.patientId);
  if (!patient) return undefined;
  return {
    id: member.id,
    name: member.name,
    role: 'family_member',
    orgType: 'family',
    orgId: patient.hospiceId,
    email: member.email,
    phone: member.phone,
    avatarPath: '',
    patientId: member.patientId,
  };
}

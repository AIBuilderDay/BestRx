/**
 * Shaping for the read-only family view. A family member sees only their one patient: who cares
 * for them, and what equipment is at the home. No vendor internals, no ordering, no PPD — see
 * FamilyView.tsx. All values derive from the mock DB and the family store.
 */

import { getHospice, getOrdersForPatient, getPatient, getUser } from '../data/db';
import { getFamilyMember } from './familyMembers';
import { patientFullName } from './catalog';
import { buildOrderEquipmentVM, formatPatientAddress } from './patients';
import type { PatientStatus, User } from '../types/domain';

export interface FamilyEquipmentVM {
  orderId: string;
  name: string;
  statusLabel: string;
  whenLabel: string;
  when: string;
}

export interface FamilyViewVM {
  patientName: string;
  relationship: string;
  statusLabel: string;
  hospiceName: string;
  hospiceMarket: string;
  addressLine1: string;
  addressLine2: string;
  careTeam: { name: string; phone: string } | null;
  equipment: FamilyEquipmentVM[];
}

/**
 * The card on file for a family member. Static mock: staff (nurses) never see or need this — the
 * hospice contract pays for their orders — but a family member buying directly pays themselves.
 */
export const FAMILY_CARD = { brand: 'Visa', last4: '4242', holder: 'On file' };
export const familyCardLabel = `${FAMILY_CARD.brand} ···· ${FAMILY_CARD.last4}`;

const STATUS_LABELS: Record<PatientStatus, string> = {
  active: 'Receiving care at home',
  pending_discharge: 'Preparing for discharge',
  discharged: 'Discharged from hospice care',
  deceased: 'No longer in care',
};

export function buildFamilyViewVM(user: User): FamilyViewVM | null {
  if (!user.patientId) return null;
  const patient = getPatient(user.patientId);
  if (!patient) return null;

  const member = getFamilyMember(user.id);
  const hospice = getHospice(patient.hospiceId);
  const caseManager = getUser(patient.caseManagerId);
  const addr = formatPatientAddress(patient.address);

  return {
    patientName: patientFullName(patient),
    relationship: member?.relationship ?? 'Family',
    statusLabel: STATUS_LABELS[patient.status],
    hospiceName: hospice?.name ?? 'Your hospice',
    hospiceMarket: hospice?.market ?? '',
    addressLine1: addr.line1,
    addressLine2: addr.line2,
    careTeam: caseManager ? { name: caseManager.name, phone: caseManager.phone } : null,
    equipment: getOrdersForPatient(patient.id).map((order) => {
      const vm = buildOrderEquipmentVM(order);
      return {
        orderId: vm.orderId,
        name: vm.name,
        statusLabel: vm.statusLabel,
        whenLabel: vm.whenLabel,
        when: vm.when,
      };
    }),
  };
}

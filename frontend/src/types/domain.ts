/**
 * Shared domain types for the BestRx mock database.
 *
 * These mirror the JSON "tables" in src/data/ one-to-one. If a table changes, change the type in
 * the same commit and update docs/DATA_MODEL.md.
 */

export type OrderStatus =
  | 'ordered'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'pickup_triggered'
  | 'picked_up';

export type RiskState = 'at_risk' | 'pickup_delayed';

export type OrderType = 'admission' | 'routine' | 'resupply' | 'pickup';

export type Urgency = 'stat' | 'urgent' | 'routine';

export type PatientStatus = 'active' | 'pending_discharge' | 'discharged' | 'deceased';

export type UserRole =
  | 'admissions_nurse'
  | 'case_manager'
  | 'field_nurse'
  | 'director_of_nursing'
  | 'hospice_admin'
  | 'vendor_dispatcher';

export type EquipmentCategory =
  | 'bed'
  | 'respiratory'
  | 'mobility'
  | 'bathroom_safety'
  | 'consumable';

export type InventoryState = 'in_stock' | 'deployed' | 'awaiting_pickup' | 'maintenance';

export type PickupTriggerType = 'field_nurse' | 'emr_status_change' | 'manual_call';

export interface EquipmentItem {
  hcpcs: string;
  name: string;
  qty: number;
}

export interface CatalogEntry {
  hcpcs: string;
  name: string;
  description: string;
  category: EquipmentCategory;
  rental: boolean;
  avgMonthlyAllowedUsd?: number;
  avgPurchaseAllowedUsd?: number;
  resupplyCadenceDays?: number;
  imagePath: string;
}

export interface Hospice {
  id: string;
  name: string;
  market: string;
  emr: 'HCHB' | 'Axxess' | 'WellSky' | 'MatrixCare';
  activeCensus: number;
  logoPath: string;
}

export interface VendorSla {
  statDeliveryHours: number;
  routineDeliveryHours: number;
  pickupHours: number;
}

export interface Vendor {
  id: string;
  name: string;
  market: string;
  serviceAreaZips: string[];
  hours: string;
  contact: { dispatchPhone: string; dispatchEmail: string; repName: string };
  fleet: { trucks: number; routesToday: number; capacityUsedPct: number };
  sla: VendorSla;
  performance30d: {
    onTimeDeliveryPct: number;
    onTimePickupPct: number;
    avgDeliveryHours: number;
    podCapturePct: number;
  };
  logoPath: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  orgType: 'hospice' | 'vendor';
  orgId: string;
  /** Login identity. Unique across users; permissions derive from `role` in lib/auth.ts. */
  email: string;
  phone: string;
  avatarPath: string;
}

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface Patient {
  id: string;
  hospiceId: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  status: PatientStatus;
  statusChangedAt: string;
  /** Present only while status is pending_discharge. */
  dischargeAt?: string;
  primaryDiagnosis: { codeType: string; code: string; description: string };
  address: Address;
  caseManagerId: string;
}

export interface RiskAssessment {
  /** 0-1. Higher is worse. */
  score: number;
  /** One plain sentence a case manager can read aloud. Never a black box. */
  reason: string;
  factors: string[];
  escalation?: {
    state: 'open' | 'escalated_to_vendor_rep' | 'resolved';
    assignedToId: string | null;
    openedAt: string;
  };
}

export interface ProofOfCapture {
  signature: boolean;
  photo: boolean;
  capturedAt: string;
}

export interface Order {
  id: string;
  /** True for the six orders supplied verbatim by the bounty organizers. Do not edit those. */
  canonical: boolean;
  status: OrderStatus;
  riskState: RiskState | null;
  patientId: string;
  hospiceId: string;
  vendorId: string | null;
  orderedById: string | null;
  orderType: OrderType;
  urgency: Urgency;
  equipment: EquipmentItem[];
  orderedAt?: string;
  targetBy?: string;
  eta?: string | null;
  route?: number;
  deliveredAt?: string;
  proofOfDelivery?: ProofOfCapture;
  billing?: { claimTriggered: boolean; claimStandard: string; status: string };
  resupply?: { cadenceDays: number; nextDue: string };
  dischargeReadiness?: { required: boolean; confirmed: boolean };
  trigger?: { type: PickupTriggerType; value: string; source: string };
  pickupTriggeredAt?: string;
  pickupDueBy?: string;
  pickedUpAt?: string;
  proofOfPickup?: ProofOfCapture;
  familyContacts?: number;
  risk?: RiskAssessment;
  notes: string;
}

export type OrderEventName =
  | 'ordered'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'billing_triggered'
  | 'pickup_triggered'
  | 'vendor_notified'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'risk_flagged'
  | 'escalated'
  | 'sla_breached'
  | 'family_contact';

export interface OrderEvent {
  id: string;
  orderId: string;
  at: string;
  event: OrderEventName;
  actorId: string | null;
  detail: string;
}

export interface InventoryUnit {
  serial: string;
  vendorId: string;
  hcpcs: string;
  state: InventoryState;
  orderId: string | null;
  overdue?: boolean;
  lastServicedAt: string;
}

/**
 * What one vendor charges for one catalog item, and how fast they say they can deliver it.
 * This is the storefront row: the thing a nurse sorts and compares before adding to a cart.
 */
export interface VendorOffer {
  id: string;
  vendorId: string;
  hcpcs: string;
  priceUsd: number;
  unit: 'month' | 'purchase';
  inStock: boolean;
  /** Vendor's own promise, not a measurement. Compare against vendor.performance30d. */
  deliveryEtaHours: number;
  /** 1-5, averaged from the nurses who received previous deliveries. */
  nurseRating: number;
  ratingCount: number;
}

export interface Budget {
  id: string;
  hospiceId: string;
  /** Either a spending cap for a role, or a cap on one patient's equipment. */
  scope: 'role' | 'patient_purchase';
  /** A UserRole when scope is 'role', a patient id when scope is 'patient_purchase'. */
  scopeRef: string;
  /** Calendar month, YYYY-MM. */
  period: string;
  /**
   * The cap for the period. For role budgets this is derived, not guessed:
   * ppdUsd x assignedPatients x days, following mockups/cost-ledger.html.
   */
  limitUsd: number;
  spentUsd: number;
  setById: string | null;
  derivedFrom?: { ppdUsd: number; assignedPatients: number; days: number };
}

export interface EmrEvent {
  id: string;
  eventType: 'newOrUpdatePatient' | 'patientStatusChange' | 'newMedications';
  receivedAt: string;
  source: string;
  hospiceId: string;
  patientId: string;
  payload: Record<string, unknown>;
  note?: string;
}

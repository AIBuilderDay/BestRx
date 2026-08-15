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
  | 'vendor_dispatcher'
  // A patient's relative who signs in only to follow their loved one — see FamilyMember below.
  | 'family_member';

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
  /** Rented or bought. Absent on orders placed before the choice existed: read the offer's default. */
  unit?: 'month' | 'purchase';
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
  /** Short label shown in the catalog and cart (e.g. "Vendor 1"). */
  displayName: string;
  market: string;
  /**
   * The hospice's incumbent vendor — the one whose prices the cost ledger treats as the baseline
   * every other vendor is compared against. Exactly one vendor per market carries this.
   */
  contracted: boolean;
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
  /**
   * Hospice-wide vendor scorecard metric. Visible only to director_of_nursing and hospice_admin —
   * not shown on the catalog storefront.
   */
  overallRating: number;
  overallRatingCount: number;
}

export interface RealVendorLocation {
  city: string;
  state: string;
  street1: string;
  zip: string;
  phone: string;
}

/**
 * A real, publicly-listed DME supplier scraped from the vendor's own site or a directory listing.
 *
 * Deliberately NOT a `Vendor`. `Vendor` carries simulated operational telemetry (fleet, sla,
 * performance30d, overallRating) that no supplier publishes; inventing those for a named real
 * company would violate the "no invented vendor facts" rule in CLAUDE.md. Every field here is
 * either sourced or null, and `sourceUrl` records where it came from.
 */
export interface RealVendor {
  id: string;
  name: string;
  displayName: string;
  scope: 'national' | 'regional';
  market: string;
  headquarters: {
    street1: string | null;
    city: string;
    state: string;
    zip: string | null;
  } | null;
  /** Null when the source does not publish hours. */
  hours: string | null;
  contact: {
    dispatchPhone: string | null;
    dispatchEmail: string | null;
    repName: string | null;
  };
  /** Prose service area as stated by the source — suppliers publish this, not ZIP lists. */
  serviceAreaDescription: string;
  /** Null when the source states a count of states but not which ones. */
  statesServed: string[] | null;
  locationCount: number;
  /** Empty when individual branch addresses are not published. */
  locations: RealVendorLocation[];
  /** HCPCS codes from equipment_catalog.json this vendor's published lines cover. */
  hcpcsCarried: string[];
  categoriesCarried: string[];
  catalogNotes: string;
  hospiceFocused: boolean;
  logoPath: string | null;
  sourceUrl: string;
  /** ISO date the source page was read. */
  sourceRetrieved: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  orgType: 'hospice' | 'vendor' | 'family';
  /** Hospice or vendor id. For a family member, the hospice caring for their patient. */
  orgId: string;
  /** Login identity. Unique across users; permissions derive from `role` in lib/auth.ts. */
  email: string;
  phone: string;
  avatarPath: string;
  /** Set only for a family_member session: the one patient this account may follow. */
  patientId?: string;
}

/**
 * A patient's relative, linked to exactly one patient. They can sign in to a read-only family
 * view, and are the audience for delivery notifications (the SQS/messaging layer to come). Kept in
 * a runtime store (lib/familyMembers.ts), not a frozen JSON table, because staff add them live.
 */
export interface FamilyMember {
  id: string;
  patientId: string;
  name: string;
  /** How they relate to the patient, e.g. "Daughter", "Spouse". Free text. */
  relationship: string;
  /** Login identity and notification address. */
  email: string;
  phone: string;
  /** Whether this contact should receive delivery notifications once messaging is wired up. */
  notify: boolean;
  addedAt: string;
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
  /** Optional placeholder portrait for the patient card UI. */
  imagePath?: string;
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
  /** Denormalized from equipment_catalog for a self-contained storefront row. */
  productName: string;
  description: string;
  category: EquipmentCategory;
  /** Monthly rental rate. Absent when the item is sold outright only (walker, commode, mask). */
  rentalPriceUsd?: number;
  /** One-time purchase price. Absent when the vendor only rents this SKU. */
  purchasePriceUsd?: number;
  /** The arrangement this offer defaults to. At least one of the two prices is always present. */
  unit: 'month' | 'purchase';
  inStock: boolean;
  /** Vendor's own promise, not a measurement. Compare against vendor.performance30d. */
  deliveryEtaHours: number;
  /** Whole days promised for catalog display. Auditable counterpart to deliveryEtaHours. */
  deliveryLeadDays: number;
  /** Listing image for this vendor's SKU. */
  imagePath: string;
}

/** One nurse review of a specific vendor offer (one vendor SKU). */
export interface ProductReview {
  id: string;
  offerId: string;
  /** 1-5 stars. */
  rating: number;
  reviewedAt: string;
  reviewerId: string;
  comment: string;
}

export interface OfferRatingSummary {
  average: number;
  count: number;
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

/**
 * A family member asking the hospice to send a piece of equipment, instead of buying it directly.
 * Surfaces on the patient chart for staff to act on. Lives in a runtime store, like FamilyMember.
 */
export interface FamilyPurchaseRequest {
  id: string;
  patientId: string;
  familyMemberId: string;
  familyMemberName: string;
  offerId: string;
  productName: string;
  qty: number;
  requestedAt: string;
  status: 'open' | 'fulfilled' | 'declined';
}

/** Care-team note pinned to one patient chart. */
export interface PatientNote {
  id: string;
  patientId: string;
  authorId: string;
  title: string;
  body: string;
  /** Calendar date shown on the sticky-note footer (YYYY-MM-DD). */
  date: string;
  createdAt: string;
}

/**
 * The global command bar's result set: pages, patients, orders, and catalog items that *this* user
 * is allowed to reach, for a typed query.
 *
 * Permission scoping is the whole point of this module. The full database sits in memory for every
 * signed-in session (see data/store.ts), so a bar that reads db.ts directly would happily show a
 * case manager somebody else's patient, or a family member the entire roster — things the route
 * guards in App.tsx otherwise prevent. Every group here is filtered through the same helpers the
 * real views use (`getVisibleOrders`, `getCaseloadPatients`), so there is one copy of that logic
 * and this bar cannot drift away from what the pages themselves show.
 *
 * Pure and synchronous: no model call, no fetch. Navigation must work when AI is down.
 */

import { getCatalogEntry, getPatient, getVendor, vendorOffers } from '../data/db';
import { can, isFamilyMember } from './auth';
import { patientFullName } from './catalog';
import { getVisibleOrders } from './orders';
import { getCaseloadPatients } from './patients';
import type { User } from '../types/domain';

export type CommandGroupKey = 'page' | 'patient' | 'order' | 'catalog';

export interface CommandResult {
  /** Unique across the whole result set — used as the React key and the active-item id. */
  id: string;
  group: CommandGroupKey;
  label: string;
  /** Secondary line: MRN, status, vendor — whatever identifies the row at a glance. */
  meta: string;
  /** Where picking this row navigates to. */
  to: string;
}

export interface CommandGroup {
  key: CommandGroupKey;
  label: string;
  results: CommandResult[];
}

/** Per-group ceiling, so one huge group can't bury the others. */
const GROUP_LIMIT = 5;

const GROUP_LABELS: Record<CommandGroupKey, string> = {
  page: 'Pages',
  patient: 'Patients',
  order: 'Orders',
  catalog: 'Catalog',
};

/** Every routable section, with the capability that gates it — mirrors TopNav's nav items. */
const PAGES: { label: string; to: string; visible: (user: User) => boolean }[] = [
  { label: 'Dashboard', to: '/dashboard', visible: (u) => can(u, 'reporting') },
  { label: 'Catalog', to: '/catalog', visible: (u) => can(u, 'storefront:purchase') },
  {
    label: 'Orders',
    to: '/orders',
    visible: (u) => can(u, 'orders:all') || can(u, 'orders:own-patients') || can(u, 'orders:own'),
  },
  { label: 'Patients', to: '/patients', visible: (u) => can(u, 'orders:own-patients') },
  { label: 'Assignments', to: '/assignments', visible: (u) => can(u, 'nurse-assignment') },
  { label: 'Cart', to: '/cart', visible: (u) => can(u, 'storefront:purchase') },
];

const matches = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle);

/** Patients this user may open: the whole hospice for `orders:all`, else their own caseload. */
function reachablePatients(user: User) {
  if (can(user, 'orders:all')) {
    // Hospice-wide, but still hospice-bounded — the snapshot holds more than one.
    return getVisibleOrders(user)
      .map((o) => getPatient(o.patientId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .filter((p, i, all) => all.findIndex((other) => other.id === p.id) === i);
  }
  if (can(user, 'orders:own-patients')) return getCaseloadPatients(user.id, user.orgId);
  return [];
}

function pageResults(user: User, q: string): CommandResult[] {
  return PAGES.filter((page) => page.visible(user) && matches(page.label, q)).map((page) => ({
    id: `page:${page.to}`,
    group: 'page' as const,
    label: page.label,
    meta: 'Go to page',
    to: page.to,
  }));
}

function patientResults(user: User, q: string): CommandResult[] {
  return reachablePatients(user)
    .filter((p) => matches(patientFullName(p), q) || matches(p.id, q))
    .slice(0, GROUP_LIMIT)
    .map((p) => ({
      id: `patient:${p.id}`,
      group: 'patient' as const,
      label: patientFullName(p),
      meta: `${p.id} · ${p.primaryDiagnosis.description}`,
      to: `/patients/${p.id}`,
    }));
}

function orderResults(user: User, q: string): CommandResult[] {
  return getVisibleOrders(user)
    .filter((o) => {
      const patient = getPatient(o.patientId);
      const equipment = o.equipment.map((e) => getCatalogEntry(e.hcpcs)?.name ?? '').join(' ');
      return (
        matches(o.id, q) ||
        (patient ? matches(patientFullName(patient), q) : false) ||
        matches(equipment, q)
      );
    })
    .slice(0, GROUP_LIMIT)
    .map((o) => {
      const patient = getPatient(o.patientId);
      const first = o.equipment[0];
      const itemName = first ? (getCatalogEntry(first.hcpcs)?.name ?? first.hcpcs) : 'No items';
      return {
        id: `order:${o.id}`,
        group: 'order' as const,
        label: `${o.id} · ${itemName}`,
        meta: `${patient ? patientFullName(patient) : 'Unknown patient'} · ${o.status.replace(/_/g, ' ')}`,
        // No order-detail route exists; the board filters down to the one order.
        to: `/orders?q=${encodeURIComponent(o.id)}`,
      };
    });
}

/** One row per product, not per vendor offer — five listings of the same bed is noise. */
function catalogResults(user: User, q: string): CommandResult[] {
  if (!can(user, 'storefront:purchase')) return [];
  const seen = new Set<string>();
  const results: CommandResult[] = [];
  for (const offer of vendorOffers()) {
    if (results.length >= GROUP_LIMIT) break;
    if (seen.has(offer.hcpcs)) continue;
    if (!matches(offer.productName, q) && !matches(offer.hcpcs, q)) continue;
    seen.add(offer.hcpcs);
    results.push({
      id: `catalog:${offer.id}`,
      group: 'catalog',
      label: offer.productName,
      meta: `${offer.hcpcs} · ${getVendor(offer.vendorId)?.name ?? 'Unknown vendor'}`,
      to: `/catalog/${offer.id}`,
    });
  }
  return results;
}

/**
 * Grouped, permission-filtered results for `query`. Empty groups are dropped, so the dropdown
 * renders exactly what came back. A family member gets nothing: no capability qualifies them for
 * any group, and their view has no list to search.
 */
export function searchCommands(user: User, query: string): CommandGroup[] {
  const q = query.trim().toLowerCase();
  if (!q || isFamilyMember(user)) return [];

  const groups: CommandGroup[] = [
    { key: 'page', label: GROUP_LABELS.page, results: pageResults(user, q) },
    { key: 'patient', label: GROUP_LABELS.patient, results: patientResults(user, q) },
    { key: 'order', label: GROUP_LABELS.order, results: orderResults(user, q) },
    { key: 'catalog', label: GROUP_LABELS.catalog, results: catalogResults(user, q) },
  ];

  return groups.filter((group) => group.results.length > 0);
}

/** Flat list in render order — what the arrow keys walk. */
export const flattenCommands = (groups: CommandGroup[]): CommandResult[] =>
  groups.flatMap((group) => group.results);

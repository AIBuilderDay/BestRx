import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { TopNav } from '../components/layout/TopNav';
import { NurseFilterMenu } from '../components/assignments/NurseFilterMenu';
import { NurseSelect } from '../components/assignments/NurseSelect';
import { ROLE_LABELS } from '../lib/auth';
import { patientFullName } from '../lib/catalog';
import {
  countByNurse,
  getAssignableNurses,
  getAssignablePatients,
  readAssignmentOverrides,
  writeAssignmentOverrides,
  type AssignmentMap,
} from '../lib/assignments';
import type { Patient, User } from '../types/domain';

const STATUS_LABEL: Record<Patient['status'], string> = {
  active: 'Active',
  pending_discharge: 'Pending discharge',
  discharged: 'Discharged',
  deceased: 'Deceased',
};

/**
 * Director of Nursing view: assign each patient in the hospice to a nurse. Deliberately minimal —
 * a patient list, a nurse picker per row, and a live per-nurse count so the DON can balance loads.
 */
export default function NurseAssignment({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { cartCount, setCartOpen } = useCart();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const nurses = useMemo(() => getAssignableNurses(user.orgId), [user.orgId]);
  const roster = useMemo(() => getAssignablePatients(user.orgId), [user.orgId]);

  // Seed each patient from its caseManagerId, then apply any browser-local reassignments.
  const [assignments, setAssignments] = useState<AssignmentMap>(() => {
    const overrides = readAssignmentOverrides();
    const seed: AssignmentMap = {};
    for (const p of roster) seed[p.id] = overrides[p.id] ?? p.caseManagerId;
    return seed;
  });

  const assign = (patientId: string, nurseId: string) => {
    setAssignments((prev) => {
      const next = { ...prev, [patientId]: nurseId };
      writeAssignmentOverrides(next);
      return next;
    });
  };

  const counts = useMemo(() => countByNurse(assignments), [assignments]);

  // null = show every patient; otherwise show only those currently assigned to this nurse.
  const [filterNurseId, setFilterNurseId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roster.filter((p) => {
      if (filterNurseId && assignments[p.id] !== filterNurseId) return false;
      if (q && !(patientFullName(p).toLowerCase().includes(q) || p.id.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [roster, searchQuery, filterNurseId, assignments]);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        user={user}
        cartCount={cartCount}
        activeSection="assignments"
        onOpenCart={() => setCartOpen(true)}
        onSignOut={onSignOut}
      />

      <div className="grid grid-cols-[224px_minmax(0,1fr)] items-start">
        <div aria-hidden className="border-r border-line" />

        <main className="min-w-0 px-10 pb-20 pt-8.5">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-3xl font-normal tracking-tight">Nurse Assignment</h1>
              <p className="mt-1 text-[13px] text-ink-2">
                {roster.length} {roster.length === 1 ? 'patient' : 'patients'} · {nurses.length}{' '}
                {nurses.length === 1 ? 'nurse' : 'nurses'} on your team
              </p>
            </div>
            <NurseFilterMenu
              nurses={nurses}
              value={filterNurseId}
              counts={counts}
              onChange={setFilterNurseId}
            />
          </div>

          {/* Live caseload per nurse, so the DON can see and balance the load as they assign. */}
          <div className="mb-8 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-bg-subtle text-left text-[11px] uppercase tracking-[0.08em] text-ink-3">
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Nurse</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Role</th>
                  <th className="w-full px-4 py-2 text-right font-medium">Patients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {nurses.map((n) => (
                  <tr key={n.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink">{n.name}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{ROLE_LABELS[n.role]}</td>
                    <td className="w-full px-4 py-2.5 text-right font-medium tabular-nums text-ink">
                      {counts[n.id] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 ? (
            <div className="py-5 text-[13px] text-ink-3">
              {searchQuery ? (
                <>No patients match &ldquo;{searchQuery}&rdquo;.</>
              ) : filterNurseId ? (
                'No patients are assigned to this nurse.'
              ) : (
                'No patients to assign.'
              )}
            </div>
          ) : (
            <div className="divide-y divide-line rounded-lg border border-line bg-surface">
              {filtered.map((patient) => {
                const name = patientFullName(patient);
                return (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium tracking-tight text-ink">
                        {name}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-3">
                        <span className="font-mono">{patient.id}</span> · {STATUS_LABEL[patient.status]}
                      </div>
                    </div>

                    <NurseSelect
                      nurses={nurses}
                      value={assignments[patient.id] ?? ''}
                      onChange={(nurseId) => assign(patient.id, nurseId)}
                      ariaLabel={`Assign nurse for ${name}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

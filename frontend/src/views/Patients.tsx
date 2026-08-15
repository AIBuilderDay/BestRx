import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { TopNav } from '../components/layout/TopNav';
import { PatientCard } from '../components/patients/PatientCard';
import {
  caseloadAttentionTotal,
  caseloadSubtitle,
  filterCaseload,
  getCaseloadPatients,
  sortCaseload,
} from '../lib/patients';
import type { User } from '../types/domain';

export default function Patients({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { cartCount, setCartOpen } = useCart();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const caseload = useMemo(
    () => getCaseloadPatients(user.id, user.orgId),
    [user.id, user.orgId],
  );
  const attentionTotal = useMemo(() => caseloadAttentionTotal(caseload), [caseload]);
  const filtered = useMemo(
    () => sortCaseload(filterCaseload(caseload, searchQuery)),
    [caseload, searchQuery],
  );

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        user={user}
        cartCount={cartCount}
        activeSection="patients"
        onOpenCart={() => setCartOpen(true)}
        onSignOut={onSignOut}
      />

      {/* No filter sidebar on Patients, so the content spans the full width at every size —
          a phantom 224px column only read as an empty left margin on tablet widths. */}
      <main className="min-w-0 px-4 pb-16 pt-5 sm:px-6 lg:px-10 lg:pb-20 lg:pt-8.5">
          <div className="mb-5 lg:mb-7.5">
            <h1 className="text-2xl font-normal tracking-tight lg:text-3xl">Patients</h1>
            <p className="mt-1 text-[13px] text-ink-2">{caseloadSubtitle(caseload, attentionTotal)}</p>
          </div>

          {filtered.length === 0 ? (
            <div className="py-5 text-[13px] text-ink-3">
              {searchQuery ? (
                <>No patients on your caseload match &ldquo;{searchQuery}&rdquo;.</>
              ) : (
                'No patients on your caseload match that.'
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(236px,1fr))] lg:gap-x-6.5 lg:gap-y-10">
              {filtered.map((patient, i) => (
                <div
                  key={patient.id}
                  className="h-full min-w-0 animate-card-in motion-reduce:animate-none"
                  style={{ animationDelay: `${i * 0.045}s` }}
                >
                  <PatientCard patient={patient} />
                </div>
              ))}
            </div>
          )}
        </main>
    </div>
  );
}

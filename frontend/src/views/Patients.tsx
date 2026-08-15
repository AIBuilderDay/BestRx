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
  const filtered = useMemo(() => filterCaseload(caseload, searchQuery), [caseload, searchQuery]);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        user={user}
        cartCount={cartCount}
        activeSection="patients"
        onOpenCart={() => setCartOpen(true)}
        onSignOut={onSignOut}
      />

      <main className="mx-auto max-w-[1220px] px-8 pb-20 pt-6.5">
        <div className="mb-5">
          <h1 className="text-3xl font-normal tracking-tight">My patients</h1>
          <div className="mt-1 text-[13px] text-ink-2">
            {caseloadSubtitle(caseload, attentionTotal)}
          </div>
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-x-6.5 gap-y-10">
            {filtered.map((patient, i) => (
              <div
                key={patient.id}
                className="h-full min-w-0 animate-[cardIn_0.55s_cubic-bezier(0.2,0.7,0.2,1)_both]"
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

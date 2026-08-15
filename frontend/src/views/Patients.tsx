import { useMemo, useState } from 'react';
import { getHospice } from '../data/db';
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

export default function Patients({ user }: { user: User }) {
  const hospice = getHospice(user.orgId);
  const { cartCount, setCartOpen } = useCart();
  const [query, setQuery] = useState('');

  const caseload = useMemo(
    () => getCaseloadPatients(user.id, user.orgId),
    [user.id, user.orgId],
  );
  const attentionTotal = useMemo(() => caseloadAttentionTotal(caseload), [caseload]);
  const filtered = useMemo(() => filterCaseload(caseload, query), [caseload, query]);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        hospiceName={hospice?.name ?? 'Hospice'}
        user={user}
        cartCount={cartCount}
        activeSection="patients"
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-[1220px] px-8 pb-20 pt-6.5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">My patients</h1>
            <div className="mt-1 text-[13px] text-[var(--color-ink-2)]">
              {caseloadSubtitle(caseload, attentionTotal)}
            </div>
          </div>
          <input
            type="text"
            placeholder="Search patients or MRN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-[250px] rounded-lg border border-[var(--color-line-strong)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="py-5 text-[13px] text-[var(--color-ink-3)]">No patients on your caseload match that.</div>
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

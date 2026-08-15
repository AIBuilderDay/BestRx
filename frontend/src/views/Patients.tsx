import { useMemo, useState } from 'react';
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
        user={user}
        cartCount={cartCount}
        activeSection="patients"
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-[1220px] px-8 pb-20 pt-6.5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-normal tracking-tight">My patients</h1>
            <div className="mt-1 text-[13px] text-ink-2">
              {caseloadSubtitle(caseload, attentionTotal)}
            </div>
          </div>
          <div className="relative w-[250px]">
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            >
              <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <line
                x1="13.2"
                y1="13.2"
                x2="17"
                y2="17"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search patients or MRN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-ink"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-5 text-[13px] text-ink-3">No patients on your caseload match that.</div>
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

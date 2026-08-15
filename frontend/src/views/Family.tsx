import { useMemo } from 'react';
import { TopNav } from '../components/layout/TopNav';
import { useCart } from '../context/CartContext';
import { buildFamilyViewVM } from '../lib/family';
import type { User } from '../types/domain';

/**
 * Read-only home for a patient's family member. Deliberately tiny: who is caring for their loved
 * one, and what equipment is at the home. No orders board, no cost figures. This is also where
 * delivery notifications will surface once the SQS/messaging layer is wired up.
 */
export default function Family({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { cartCount, setCartOpen } = useCart();
  const vm = useMemo(() => buildFamilyViewVM(user), [user]);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        user={user}
        cartCount={cartCount}
        activeSection="patients"
        onOpenCart={() => setCartOpen(true)}
        onSignOut={onSignOut}
      />

      <main className="mx-auto max-w-[640px] px-5 pb-20 pt-8">
        {!vm ? (
          <p className="text-[13px] text-ink-3">
            We couldn&rsquo;t load your family member&rsquo;s information. Please contact the hospice.
          </p>
        ) : (
          <>
            <div className="mb-7">
              <p className="text-[13px] text-ink-3">Following as {vm.relationship}</p>
              <h1 className="mt-1 text-3xl font-normal tracking-tight">{vm.patientName}</h1>
              <p className="mt-1.5 text-[13px] text-ink-2">{vm.statusLabel}</p>
            </div>

            <section className="mb-5 rounded-[10px] border border-line bg-surface p-4">
              <h2 className="mb-3 text-[13px] font-semibold tracking-tight">Care team</h2>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-[13px]">
                <div className="whitespace-nowrap text-ink-3">Hospice</div>
                <div className="text-right">{vm.hospiceName}</div>
                {vm.hospiceMarket ? (
                  <>
                    <div className="whitespace-nowrap text-ink-3">Location</div>
                    <div className="text-right">{vm.hospiceMarket}</div>
                  </>
                ) : null}
                {vm.careTeam ? (
                  <>
                    <div className="whitespace-nowrap text-ink-3">Case manager</div>
                    <div className="text-right">{vm.careTeam.name}</div>
                    <div className="whitespace-nowrap text-ink-3">Phone</div>
                    <div className="text-right">
                      <a
                        href={`tel:${vm.careTeam.phone.replace(/\D/g, '')}`}
                        className="underline underline-offset-2"
                      >
                        {vm.careTeam.phone}
                      </a>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <section className="mb-5 rounded-[10px] border border-line bg-surface p-4">
              <h2 className="mb-3 text-[13px] font-semibold tracking-tight">Equipment at home</h2>
              {vm.equipment.length === 0 ? (
                <p className="text-[13px] text-ink-3">No equipment has been ordered yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {vm.equipment.map((item) => (
                    <li key={item.orderId} className="flex flex-wrap items-baseline gap-x-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="min-w-0 flex-1 text-[13px] font-medium">{item.name}</span>
                      <span className="whitespace-nowrap text-[13px] text-ink-2">{item.statusLabel}</span>
                      <span className="w-full text-[12px] text-ink-3">
                        {item.whenLabel}: {item.when}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-[12px] leading-relaxed text-ink-3">
              You&rsquo;ll be notified here and by text when equipment is delivered or picked up.
              <span className="text-ink-3"> (Notifications coming soon.)</span>
            </p>
          </>
        )}
      </main>
    </div>
  );
}

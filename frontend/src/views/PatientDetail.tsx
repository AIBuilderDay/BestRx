import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { OrderListSection } from '../components/orders/OrderListSection';
import { OrderReceiptDialog } from '../components/orders/OrderReceiptDialog';
import { PatientIdentityRail } from '../components/patients/PatientIdentityRail';
import { PatientTabs, type PatientTab } from '../components/patients/PatientTabs';
import { TopNav } from '../components/layout/TopNav';
import { useCart } from '../context/CartContext';
import { getOrdersForPatient } from '../data/db';
import { moneyLabel } from '../lib/catalog';
import { buildOrderListItemVM, type OrderListItemVM } from '../lib/orders';
import { buildPatientDetailVM, isInCaseload } from '../lib/patients';
import type { User } from '../types/domain';

interface SessionNote {
  meta: string;
  text: string;
}

export default function PatientDetail({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { patientId } = useParams<{ patientId: string }>();
  const { cartCount, setCartOpen } = useCart();

  const [draft, setDraft] = useState('');
  const [addedNotes, setAddedNotes] = useState<SessionNote[]>([]);
  const [tab, setTab] = useState<PatientTab>('Orders');
  const [invoiceItem, setInvoiceItem] = useState<OrderListItemVM | null>(null);

  const inCaseload = patientId ? isInCaseload(patientId, user.id, user.orgId) : false;
  const vm = useMemo(
    () => (patientId && inCaseload ? buildPatientDetailVM(patientId) : null),
    [patientId, inCaseload],
  );

  // The same view-model the Orders list renders, so a patient's orders look identical there.
  const orderItems = useMemo(
    () => (patientId && inCaseload ? getOrdersForPatient(patientId).map(buildOrderListItemVM) : []),
    [patientId, inCaseload],
  );

  const handleAddNote = () => {
    const text = draft.trim();
    if (!text) return;
    setAddedNotes((prev) => [{ meta: `Just now · ${user.name}`, text }, ...prev]);
    setDraft('');
  };

  const handleCallVendor = (item: OrderListItemVM) => {
    const digits = item.phone.replace(/\D/g, '');
    if (digits) window.location.href = `tel:${digits}`;
  };

  const handleCopyAddr = () => {
    if (!vm) return;
    void navigator.clipboard?.writeText(`${vm.addressLine1}\n${vm.addressLine2}`);
  };

  const topNav = (
    <TopNav
      user={user}
      cartCount={cartCount}
      activeSection="patients"
      onOpenCart={() => setCartOpen(true)}
      onSignOut={onSignOut}
    />
  );

  if (!patientId || !inCaseload || !vm) {
    return (
      <div className="min-h-screen bg-bg">
        {topNav}
        <main className="mx-auto max-w-[1220px] px-8 py-12">
          <p className="text-[13px] text-ink-3">This patient is not on your caseload or could not be found.</p>
          <Link to="/patients" className="mt-4 inline-block text-[13px] underline underline-offset-2">
            Back to all my patients
          </Link>
        </main>
      </div>
    );
  }

  const { patient, fullName, addressLine1, addressLine2, railFacts } = vm;

  const orderCards =
    orderItems.length === 0 ? (
      <div className="rounded-card border border-line px-4 py-6 text-[13px] text-ink-3">
        No equipment orders on file for this patient.
      </div>
    ) : (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Products ordered</h2>
          <span className="text-[13px] text-ink-3">
            {orderItems.length} {orderItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <OrderListSection
          items={orderItems}
          onCallVendor={handleCallVendor}
          onDownloadReceipt={setInvoiceItem}
        />

        {vm.costTotalUsd > 0 ? (
          <div className="flex justify-end pt-1 text-[13px] text-ink-2">
            <span>
              {vm.costTotalPriced ? 'Total' : 'Total so far'}{' '}
              <span className="font-bold text-ink tabular-nums">
                {moneyLabel(vm.costTotalUsd)}
                {vm.costTotalUnit === '/mo' ? '/mo' : ''}
              </span>
              {vm.costTotalUnit === 'mixed' ? ' (mixed billing)' : ''}
              {vm.costTotalPriced ? '' : ' — some items unpriced'}
            </span>
          </div>
        ) : null}
      </div>
    );

  return (
    <div className="min-h-screen bg-bg">
      {topNav}

      <main className="mx-auto max-w-[1220px] px-8 pb-20 pt-5.5">
        <Link
          to="/patients"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[13px] transition-colors hover:bg-hover"
        >
          <span className="text-sm leading-none">←</span>
          <span>All my patients</span>
        </Link>

        <div className="grid grid-cols-1 items-start overflow-hidden rounded-panel border border-line bg-surface lg:grid-cols-[340px_minmax(0,1fr)]">
          <PatientIdentityRail
            mrn={patient.id}
            firstName={patient.firstName}
            lastName={patient.lastName}
            fullName={fullName}
            imagePath={patient.imagePath}
            facts={railFacts}
            addressLine1={addressLine1}
            addressLine2={addressLine2}
            onCopyAddress={handleCopyAddr}
          />

          <div className="flex min-w-0 flex-col">
            <PatientTabs active={tab} onSelect={setTab} />

            <div className="flex flex-col gap-5.5 px-8 pt-6 pb-7.5">
              {tab === 'Orders' ? orderCards : null}

              {tab === 'Notes' ? (
                <div className="flex flex-col gap-3.5">
                  <textarea
                    placeholder="Add a note for this patient — visible to the care team."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-card border border-line bg-bg-subtle px-3 py-2.5 text-[14.5px] text-ink outline-none focus:border-line-strong"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddNote}
                      className="cursor-pointer rounded-lg border border-solid-bg bg-solid-bg px-4 py-2.5 text-[13.5px] font-semibold text-solid-ink transition-opacity hover:opacity-85"
                    >
                      Add note
                    </button>
                  </div>
                  {addedNotes.length === 0 ? (
                    <p className="text-[13px] text-ink-3">No notes added this session.</p>
                  ) : (
                    <div className="flex flex-col">
                      {addedNotes.map((n, i) => (
                        <div
                          key={`added-${i}`}
                          className="flex gap-3.5 border-b border-line py-3.5 text-[14.5px] last:border-b-0"
                        >
                          <span className="w-16 flex-none text-[13px] text-ink-3">{n.meta}</span>
                          <span className="flex-1 text-pretty">{n.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {tab === 'Documents' ? (
                <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong px-4 py-10 text-ink-3">
                  <UploadFileOutlinedIcon sx={{ fontSize: 26 }} />
                  <span className="text-sm">No documents on file</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <OrderReceiptDialog item={invoiceItem} onClose={() => setInvoiceItem(null)} />
    </div>
  );
}

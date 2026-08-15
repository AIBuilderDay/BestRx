import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getHospice, getUser } from '../data/db';
import { ProductsOrderedSection } from '../components/patients/ProductsOrderedSection';
import { AddressMapPreview } from '../components/patients/AddressMapPreview';
import { TopNav } from '../components/layout/TopNav';
import { useCart } from '../context/CartContext';
import { buildPatientDetailVM, isInCaseload } from '../lib/patients';
import type { PatientEquipmentVM } from '../lib/patients';
import { CURRENT_USER_ID, HOSPICE_ID } from '../lib/session';

interface SessionNote {
  meta: string;
  text: string;
}

export default function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const hospice = getHospice(HOSPICE_ID);
  const currentUser = getUser(CURRENT_USER_ID);
  const { cartCount, setCartOpen } = useCart();

  const [draft, setDraft] = useState('');
  const [addedNotes, setAddedNotes] = useState<SessionNote[]>([]);

  const inCaseload = patientId ? isInCaseload(patientId, CURRENT_USER_ID, HOSPICE_ID) : false;
  const vm = useMemo(
    () => (patientId && inCaseload ? buildPatientDetailVM(patientId) : null),
    [patientId, inCaseload],
  );

  const [imgBroken, setImgBroken] = useState(false);

  const handleAddNote = () => {
    const text = draft.trim();
    if (!text) return;
    setAddedNotes((prev) => [
      { meta: `Just now · ${currentUser?.name ?? 'Case manager'}`, text },
      ...prev,
    ]);
    setDraft('');
  };

  const handleCallVendor = (item: PatientEquipmentVM) => {
    const digits = item.phone.replace(/\D/g, '');
    if (digits) window.location.href = `tel:${digits}`;
  };

  const handleDirections = () => {
    if (!vm) return;
    const query = encodeURIComponent(`${vm.addressLine1}, ${vm.addressLine2}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyAddr = () => {
    if (!vm) return;
    const text = `${vm.addressLine1}\n${vm.addressLine2}`;
    void navigator.clipboard?.writeText(text);
  };

  if (!patientId || !inCaseload || !vm) {
    return (
      <div className="min-h-screen bg-white">
        <TopNav
          hospiceName={hospice?.name ?? 'Hospice'}
          userName={currentUser?.name ?? 'Case manager'}
          cartCount={cartCount}
          activeSection="patients"
          onOpenCart={() => setCartOpen(true)}
        />
        <main className="mx-auto max-w-[1220px] px-8 py-12">
          <p className="text-[13px] text-[var(--color-ink-3)]">This patient is not on your caseload or could not be found.</p>
          <Link to="/patients" className="mt-4 inline-block text-[13px] underline underline-offset-2">
            Back to all my patients
          </Link>
        </main>
      </div>
    );
  }

  const { patient, fullName, addressLine1, addressLine2, equipment, facts } = vm;
  const imagePath = patient.imagePath;

  return (
    <div className="min-h-screen bg-white">
      <TopNav
        hospiceName={hospice?.name ?? 'Hospice'}
        userName={currentUser?.name ?? 'Case manager'}
        cartCount={cartCount}
        activeSection="patients"
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-[1220px] px-8 pb-20 pt-5.5">
        <Link
          to="/patients"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[var(--color-line-strong)] bg-white px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--color-hover)]"
        >
          <span className="text-sm leading-none">←</span>
          <span>All my patients</span>
        </Link>

        <div className="mb-5 flex flex-wrap items-start gap-4">
          <div className="h-[84px] w-[84px] flex-none overflow-hidden border border-[var(--color-line)] bg-[var(--color-bg-subtle)]">
            {imagePath && !imgBroken ? (
              <img
                src={imagePath}
                alt={fullName}
                onError={() => setImgBroken(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  backgroundImage: 'repeating-linear-gradient(135deg, #ececec 0 6px, #f5f5f5 6px 12px)',
                }}
              />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight">{fullName}</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="ml-auto flex-none cursor-pointer rounded-[7px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3.5 py-2 text-[13px] font-medium whitespace-nowrap text-white transition-opacity hover:opacity-85"
          >
            New order
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <ProductsOrderedSection equipment={equipment} onCallVendor={handleCallVendor} />

            <section className="overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-white">
              <div className="border-b border-[var(--color-line)] bg-[var(--color-bg-subtle)] px-4 py-3.5">
                <h2 className="text-[13px] font-semibold tracking-tight">Notes</h2>
              </div>
              <div className="p-4">
                <textarea
                  placeholder="Add a note for this patient — visible to the care team."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-subtle)] px-2.5 py-2.5 text-[var(--color-ink)] outline-none focus:border-[var(--color-line-strong)]"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="cursor-pointer rounded-[7px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                  >
                    Add note
                  </button>
                </div>
                <div className="mt-1.5 flex flex-col">
                  {addedNotes.map((n, i) => (
                    <div key={`added-${i}`} className="border-t border-[var(--color-line)] py-3 first:border-t-0">
                      <div className="text-xs tabular-nums text-[var(--color-ink-3)]">{n.meta}</div>
                      <div className="mt-0.5 text-[13px] text-pretty">{n.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="rounded-[10px] border border-[var(--color-line)] bg-white p-4">
              <h2 className="mb-3 text-[13px] font-semibold tracking-tight">Patient</h2>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-[13px]">
                {facts.map((f) => (
                  <div key={f.key} className="contents">
                    <div className="whitespace-nowrap text-[var(--color-ink-3)]">{f.key}</div>
                    <div className="text-right tabular-nums">{f.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[10px] border border-[var(--color-line)] bg-white p-4">
              <h2 className="mb-2.5 text-[13px] font-semibold tracking-tight">Address</h2>
              <div className="text-[13px] leading-relaxed">
                {addressLine1}
                <br />
                {addressLine2}
              </div>
              <AddressMapPreview addressLine1={addressLine1} addressLine2={addressLine2} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDirections}
                  className="cursor-pointer rounded-[7px] border border-[var(--color-line-strong)] bg-white px-2.5 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover)]"
                >
                  Directions
                </button>
                <button
                  type="button"
                  onClick={handleCopyAddr}
                  className="cursor-pointer rounded-[7px] border border-[var(--color-line-strong)] bg-white px-2.5 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover)]"
                >
                  Copy for vendor
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

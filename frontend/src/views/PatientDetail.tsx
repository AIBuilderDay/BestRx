import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProductsOrderedSection } from '../components/patients/ProductsOrderedSection';
import { PatientNotesSection } from '../components/patients/PatientNotesSection';
import { AddressMapPreview } from '../components/patients/AddressMapPreview';
import { TopNav } from '../components/layout/TopNav';
import { useCart } from '../context/CartContext';
import { patientNotes } from '../data/db';
import { buildPatientDetailVM, isInCaseload } from '../lib/patients';
import type { PatientEquipmentVM } from '../lib/patients';
import type { PatientNote, User } from '../types/domain';

export default function PatientDetail({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { cartCount, setCartOpen } = useCart();

  const [sessionNotes, setSessionNotes] = useState<PatientNote[]>([]);

  const inCaseload = patientId ? isInCaseload(patientId, user.id, user.orgId) : false;
  const vm = useMemo(
    () => (patientId && inCaseload ? buildPatientDetailVM(patientId) : null),
    [patientId, inCaseload],
  );

  const [imgBroken, setImgBroken] = useState(false);

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

  const { patient, fullName, addressLine1, addressLine2, equipment, facts } = vm;
  const imagePath = patient.imagePath;

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

        <div className="mb-5 flex flex-wrap items-start gap-4">
          <div className="h-[84px] w-[84px] flex-none overflow-hidden border border-line bg-bg-subtle">
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
                  backgroundImage: 'repeating-linear-gradient(135deg, var(--track) 0 6px, var(--hover) 6px 12px)',
                }}
              />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight">{fullName}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <ProductsOrderedSection
              equipment={equipment}
              onCallVendor={handleCallVendor}
              onNewOrder={() => navigate('/catalog')}
            />

            <PatientNotesSection
              patientId={patient.id}
              user={user}
              storedNotes={patientNotes}
              sessionNotes={sessionNotes}
              onAddNote={(note) => setSessionNotes((prev) => [note, ...prev])}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="rounded-[10px] border border-line bg-surface p-4">
              <h2 className="mb-3 text-[13px] font-semibold tracking-tight">Patient</h2>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-[13px]">
                {facts.map((f) => (
                  <div key={f.key} className="contents">
                    <div className="whitespace-nowrap text-ink-3">{f.key}</div>
                    <div className="text-right tabular-nums">{f.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[10px] border border-line bg-surface p-4">
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
                  className="cursor-pointer rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-xs transition-colors hover:bg-hover"
                >
                  Directions
                </button>
                <button
                  type="button"
                  onClick={handleCopyAddr}
                  className="cursor-pointer rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-xs transition-colors hover:bg-hover"
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

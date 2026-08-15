import { useEffect, useState } from 'react';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import WcOutlinedIcon from '@mui/icons-material/WcOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { portraitSrcSet, type PatientRailFact } from '../../lib/patients';
import { AddressMapPreview } from './AddressMapPreview';

const FACT_ICONS: Record<PatientRailFact['icon'], SvgIconComponent> = {
  dob: CakeOutlinedIcon,
  gender: WcOutlinedIcon,
  diagnosis: MonitorHeartOutlinedIcon,
  discharge: EventAvailableOutlinedIcon,
  address: PlaceOutlinedIcon,
};

/**
 * Copies the address, then swaps to a checkmark for a beat so the click is acknowledged. The two
 * glyphs are stacked and cross-faded, which keeps the button from resizing mid-transition.
 */
function CopyAddressButton({ onCopy }: { onCopy: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        onCopy();
        setCopied(true);
      }}
      aria-label={copied ? 'Address copied' : 'Copy address'}
      title={copied ? 'Copied' : 'Copy address'}
      className="relative grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-control border border-line-strong bg-surface transition-colors hover:bg-hover"
    >
      <ContentCopyOutlinedIcon
        className={`col-start-1 row-start-1 text-ink-2 transition-all duration-200 ${
          copied ? 'scale-75 opacity-0' : 'scale-100 opacity-100'
        }`}
        sx={{ fontSize: 15 }}
      />
      <CheckRoundedIcon
        className={`col-start-1 row-start-1 text-good transition-all duration-200 ${
          copied ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        sx={{ fontSize: 17 }}
      />
    </button>
  );
}

/**
 * The patient's identity column: portrait, MRN, name, and the icon-led fact list. Everything it
 * renders comes from the patient record — no derived or assumed values live here.
 */
export function PatientIdentityRail({
  mrn,
  firstName,
  lastName,
  fullName,
  imagePath,
  facts,
  addressLine1,
  addressLine2,
  onEdit,
  onCopyAddress,
}: {
  mrn: string;
  firstName: string;
  lastName: string;
  fullName: string;
  imagePath?: string;
  facts: PatientRailFact[];
  addressLine1: string;
  addressLine2: string;
  onEdit?: () => void;
  onCopyAddress: () => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);

  return (
    <aside className="flex flex-col border-line lg:border-r">
      <div className="aspect-square w-full overflow-hidden border-b border-line bg-bg-subtle">
        {imagePath && !imgBroken ? (
          <img
            src={imagePath}
            srcSet={portraitSrcSet(imagePath)}
            // Full width on a phone, then the fixed identity column beside the tab content.
            sizes="(min-width: 1024px) 340px, 100vw"
            alt={fullName}
            // The portrait is this page's largest element — fetch it with the document, not after.
            fetchPriority="high"
            decoding="async"
            onError={() => setImgBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, var(--track) 0 6px, var(--hover) 6px 12px)',
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-6 pt-5.5">
        <div className="text-[11px] font-semibold tracking-[0.1em] text-ink-3 tabular-nums">
          {mrn}
        </div>
        <h1 className="text-[40px] font-bold leading-[1.02] tracking-[-0.03em]">
          {firstName}
          <br />
          {lastName}
        </h1>
      </div>

      <div className="mx-6 mt-4.5 flex flex-col gap-3 border-t border-line pt-4 text-[13px] text-ink-2">
        {facts
          .filter((fact) => fact.icon !== 'address')
          .map((fact) => {
            const Icon = FACT_ICONS[fact.icon];
            return (
              <div key={fact.key} className="flex items-start gap-2.5">
                <Icon className="mt-px flex-none text-ink-3" sx={{ fontSize: 18 }} />
                <span className="min-w-0 text-pretty">
                  {fact.lines.map((line, i) => (
                    <span key={line} className="block">
                      {i > 0 ? <span className="text-ink-3">{line}</span> : line}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}

        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="mt-1.5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[13px] text-ink transition-colors hover:bg-hover"
          >
            <EditOutlinedIcon className="text-ink-2" sx={{ fontSize: 18 }} />
            Edit patient
          </button>
        ) : null}
      </div>

      <div className="mx-6 mt-4.5 mb-6 flex flex-col gap-3 border-t border-line pt-4 text-[13px]">
        <div className="flex items-start gap-2.5 text-ink-2">
          <PlaceOutlinedIcon className="mt-px flex-none text-ink-3" sx={{ fontSize: 18 }} />
          <span className="min-w-0 flex-1">
            <span className="block">{addressLine1}</span>
            <span className="block text-ink-3">{addressLine2}</span>
          </span>
          <CopyAddressButton onCopy={onCopyAddress} />
        </div>

        <AddressMapPreview addressLine1={addressLine1} addressLine2={addressLine2} />
      </div>
    </aside>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Patient } from '../../types/domain';
import { patientFullName } from '../../lib/catalog';

export function PatientCard({ patient }: { patient: Patient }) {
  const [imgBroken, setImgBroken] = useState(false);
  const name = patientFullName(patient);
  const imagePath = patient.imagePath;

  return (
    <Link to={`/patients/${patient.id}`} className="group block h-full min-w-0">
      <article className="h-full min-w-0">
        <div className="relative aspect-[3/4] overflow-hidden border border-[var(--color-line)] bg-neutral-50 transition-colors group-hover:border-[var(--color-line-strong)]">
          {imagePath && !imgBroken ? (
            <img
              src={imagePath}
              alt={name}
              onError={() => setImgBroken(true)}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          ) : (
            <>
              <div
                className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.06]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(135deg, #f0f0f0 0 8px, #fafafa 8px 16px)',
                }}
              />
              <div className="pointer-events-none absolute inset-x-2.5 top-2.5 font-mono text-[11px] leading-tight text-[var(--color-ink-3)]">
                <span>{patient.id}</span>
              </div>
            </>
          )}
        </div>
        <div className="pt-3.5">
          <div className="line-clamp-2 text-[13.5px] font-medium leading-5 tracking-tight">{name}</div>
        </div>
      </article>
    </Link>
  );
}

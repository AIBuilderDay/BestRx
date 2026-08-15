import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import {
  addFamilyMember,
  getFamilyMembersSnapshot,
  subscribeFamilyMembers,
} from '../../lib/familyMembers';

const EMPTY_FORM = { name: '', relationship: '', email: '', phone: '', notify: true };

/**
 * Family & notifications on the patient chart. Staff add relatives here; each becomes a family
 * account that can sign in to a read-only view and (once messaging ships) receive delivery alerts.
 */
export function FamilySection({ patientId }: { patientId: string }) {
  const allMembers = useSyncExternalStore(subscribeFamilyMembers, getFamilyMembersSnapshot);
  const members = useMemo(
    () => allMembers.filter((f) => f.patientId === patientId),
    [allMembers, patientId],
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    addFamilyMember({ patientId, ...form });
    setForm(EMPTY_FORM);
    setError('');
    setOpen(false);
  };

  const field =
    'w-full rounded-control border border-line-strong bg-bg px-2.5 py-1.75 text-[13px] text-ink placeholder:text-ink-3';

  return (
    <section className="rounded-[10px] border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-tight">Family &amp; notifications</h2>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer rounded-[7px] border border-line-strong bg-surface px-2.5 py-1 text-xs transition-colors hover:bg-hover"
          >
            Add family member
          </button>
        ) : null}
      </div>

      {members.length === 0 && !open ? (
        <p className="text-[13px] text-ink-3">
          No family members yet. Add one so they can follow this patient and get delivery updates.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5 first:pt-0">
              <span className="text-[13px] font-medium">{m.name}</span>
              <span className="text-[12px] text-ink-3">{m.relationship}</span>
              <span className="ml-auto text-[12px] text-ink-2">{m.email}</span>
              {m.notify ? (
                <span className="w-full text-[11px] text-ink-3">Notifications on</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              className={field}
              placeholder="Full name"
              aria-label="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={field}
              placeholder="Relationship (e.g. Daughter)"
              aria-label="Relationship"
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            />
          </div>
          <input
            className={field}
            type="email"
            placeholder="Email"
            aria-label="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className={field}
            placeholder="Phone"
            aria-label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <label className="flex items-center gap-2 text-[12px] text-ink-2">
            <input
              type="checkbox"
              checked={form.notify}
              onChange={(e) => setForm({ ...form, notify: e.target.checked })}
            />
            Send delivery notifications to this contact
          </label>
          {error ? (
            <p role="alert" className="text-[12px] text-risk">
              {error}
            </p>
          ) : null}
          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              className="cursor-pointer rounded-control border border-solid-bg bg-solid-bg px-3 py-1.5 text-[13px] font-medium text-solid-ink transition-opacity hover:opacity-85"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setForm(EMPTY_FORM);
                setError('');
              }}
              className="cursor-pointer rounded-control border border-line-strong bg-surface px-3 py-1.5 text-[13px] transition-colors hover:bg-hover"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

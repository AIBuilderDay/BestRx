export const PATIENT_TABS = ['Orders', 'Notes', 'Family', 'Documents'] as const;

export type PatientTab = (typeof PATIENT_TABS)[number];

/** Top tab strip for the patient detail content column. */
export function PatientTabs({
  active,
  onSelect,
}: {
  active: PatientTab;
  onSelect: (tab: PatientTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Patient sections"
      className="flex gap-6.5 overflow-x-auto border-b border-line px-8"
    >
      {PATIENT_TABS.map((tab) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab)}
            className={`cursor-pointer whitespace-nowrap border-b-2 py-3.5 text-sm transition-colors ${
              selected
                ? 'border-solid-bg font-semibold text-ink'
                : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

export type DashboardTab = 'cost' | 'budgets';

const TABS: { key: DashboardTab; label: string }[] = [
  { key: 'cost', label: 'Cost ledger' },
  { key: 'budgets', label: 'Budget configuration' },
];

/**
 * Replaces the mockup's left sidebar: the dashboard's two views ride the app's existing top nav,
 * so the sidebar's job shrinks to switching between them.
 */
export function DashboardTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}) {
  return (
    <div role="tablist" aria-label="Dashboard view" className="flex gap-1.5">
      {TABS.map((tab) => {
        const selected = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelectTab(tab.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
              selected
                ? 'border-solid-bg bg-solid-bg text-solid-ink'
                : 'border-line-strong bg-surface text-ink-2 hover:border-ink hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

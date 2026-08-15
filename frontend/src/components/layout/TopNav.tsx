import { Link } from 'react-router-dom';
import { can, type Permission } from '../../lib/auth';
import { RESET_CATALOG_FILTERS_STATE } from '../../lib/catalog';
import type { User } from '../../types/domain';
import { Logo } from '../ui/Logo';

export type NavSection = 'catalog' | 'patients' | 'settings';

/** Placeholder sections, shown only to roles whose permissions will unlock them when built. */
const GATED_SECTIONS: { label: string; permission: Permission }[] = [
  { label: 'Orders', permission: 'storefront:purchase' },
  { label: 'Pickups', permission: 'pickup:trigger' },
  { label: 'Costs', permission: 'reporting' },
  { label: 'Vendors', permission: 'vendors:manage' },
];

/** Sticky app header: brand, permission-gated section nav, and the cart toggle. */
export function TopNav({
  user,
  cartCount,
  activeSection,
  onOpenCart,
}: {
  user: User;
  cartCount: number;
  activeSection: NavSection;
  onOpenCart: () => void;
}) {
  const linkClass = (section: NavSection) =>
    section === activeSection
      ? 'text-ink'
      : 'text-ink-2 transition-colors hover:text-ink';

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-line bg-bg/92 px-8 py-3.5 backdrop-blur-sm">
      <div className="text-ink">
        <Logo height={26} />
      </div>

      <nav className="flex gap-6 text-xs uppercase tracking-[0.09em] text-ink-2">
        <Link
          to="/catalog"
          state={RESET_CATALOG_FILTERS_STATE}
          aria-current={activeSection === 'catalog' ? 'page' : undefined}
          className={linkClass('catalog')}
        >
          Catalog
        </Link>
        {can(user, 'orders:own-patients') ? (
          <Link
            to="/patients"
            aria-current={activeSection === 'patients' ? 'page' : undefined}
            className={linkClass('patients')}
          >
            Patients
          </Link>
        ) : null}
        {GATED_SECTIONS.filter((s) => can(user, s.permission)).map((s) => (
          <span key={s.label} className="cursor-default text-ink-2" title="Coming soon">
            {s.label}
          </span>
        ))}
        <Link
          to="/settings"
          aria-current={activeSection === 'settings' ? 'page' : undefined}
          className={linkClass('settings')}
        >
          Settings
        </Link>
      </nav>

      <div className="flex items-center gap-4.5">
        <button
          type="button"
          onClick={onOpenCart}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] uppercase tracking-[0.09em] transition-colors hover:border-ink ${
            cartCount > 0
              ? 'border-ink bg-solid-bg text-solid-ink'
              : 'border-line-strong bg-surface text-ink-2'
          }`}
        >
          Cart
          <span className="font-mono tabular-nums opacity-75">{cartCount}</span>
        </button>
      </div>
    </header>
  );
}

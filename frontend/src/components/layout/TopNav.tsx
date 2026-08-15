import { useState } from 'react';
import { Link } from 'react-router-dom';
import { can, permissionsFor, ROLE_LABELS, type Permission } from '../../lib/auth';
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

/** Sticky app header: brand, permission-gated section nav, user menu, and the cart toggle. */
export function TopNav({
  hospiceName,
  user,
  cartCount,
  activeSection,
  onOpenCart,
  onSignOut,
}: {
  hospiceName: string;
  user: User;
  cartCount: number;
  activeSection: NavSection;
  onOpenCart: () => void;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = (section: NavSection) =>
    section === activeSection
      ? 'text-[var(--color-ink)]'
      : 'text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ink)]';

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-[var(--color-line)] bg-bg/92 px-8 py-3.5 backdrop-blur-sm">
      <div className="text-ink">
        <Logo height={26} />
      </div>

      <nav className="flex gap-6 text-xs uppercase tracking-[0.09em] text-[var(--color-ink-3)]">
        <Link to="/catalog" aria-current={activeSection === 'catalog' ? 'page' : undefined} className={linkClass('catalog')}>
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
          <span key={s.label} className="cursor-default text-[var(--color-ink-3)]" title="Coming soon">
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
        <div className="relative">
          <button
            type="button"
            data-testid="user-menu-button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-[var(--radius-control)] px-2 py-1 text-xs text-[var(--color-ink-3)] transition-colors hover:bg-hover hover:text-[var(--color-ink)]"
          >
            {hospiceName} · {user.name} · {ROLE_LABELS[user.role]}
          </button>
          {menuOpen ? (
            <div
              data-testid="user-menu"
              className="absolute right-0 top-full mt-2 w-66 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 text-left shadow-lg"
            >
              <div className="text-[13px] font-medium">{user.name}</div>
              <div className="text-xs text-[var(--color-ink-3)]">
                {ROLE_LABELS[user.role]} · {hospiceName}
              </div>
              <div className="mt-2.5 mb-1 text-[11px] uppercase tracking-[0.07em] text-[var(--color-ink-3)]">
                Can
              </div>
              <ul className="grid gap-1">
                {permissionsFor(user).map((p) => (
                  <li key={p} data-permission={p} className="text-xs text-[var(--color-ink-2)]">
                    {p}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                data-testid="sign-out"
                onClick={onSignOut}
                className="mt-3 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-hover"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onOpenCart}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] uppercase tracking-[0.09em] transition-colors hover:border-[var(--color-ink)] ${
            cartCount > 0
              ? 'border-[var(--color-ink)] bg-solid-bg text-solid-ink'
              : 'border-[var(--color-line-strong)] bg-surface text-[var(--color-ink-2)]'
          }`}
        >
          Cart
          <span className="font-mono tabular-nums opacity-75">{cartCount}</span>
        </button>
      </div>
    </header>
  );
}

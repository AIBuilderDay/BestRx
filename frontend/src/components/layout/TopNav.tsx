import { Link } from "react-router-dom";
import { can, type Permission } from "../../lib/auth";
import { RESET_CATALOG_FILTERS_STATE } from "../../lib/catalog";
import type { User } from "../../types/domain";
import { Logo } from "../ui/Logo";
import { NavSearch } from "./NavSearch";
import { ProfileMenu } from "./ProfileMenu";

// "dashboard" isn't one of this bar's own links — it's reached from the profile menu — but views
// still pass it as activeSection so linkClass() has a real, never-matching value instead of a lie.
export type NavSection = "catalog" | "orders" | "patients" | "dashboard";

/** Placeholder sections, shown only to roles whose permissions will unlock them when built. */
const GATED_SECTIONS: { label: string; permissions: Permission[] }[] = [
  { label: "Pickups", permissions: ["pickup:trigger"] },
  { label: "Vendors", permissions: ["vendors:manage"] },
];

const canViewOrders = (user: User): boolean =>
  can(user, "orders:all") || can(user, "orders:own-patients") || can(user, "orders:own");

/** Sticky app header: brand, section nav, the AI search bar, cart icon, and the profile menu. */
export function TopNav({
  user,
  cartCount,
  activeSection,
  onOpenCart,
  onSignOut,
}: {
  user: User;
  cartCount: number;
  activeSection: NavSection;
  onOpenCart: () => void;
  onSignOut: () => void;
}) {
  const linkClass = (section: NavSection) =>
    section === activeSection
      ? "nav-link text-ink"
      : "nav-link text-ink-2 hover:text-ink";

  return (
    <header className="sticky top-0 z-20 grid grid-cols-[1fr_minmax(0,520px)_1fr] items-center gap-6 border-b border-line bg-bg/92 px-8 py-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <div className="shrink-0 text-ink">
          <Logo height={26} />
        </div>

        <nav className="flex shrink-0 gap-6 text-xs uppercase tracking-[0.09em] text-ink-2">
          <Link
            to="/catalog"
            state={RESET_CATALOG_FILTERS_STATE}
            aria-current={activeSection === "catalog" ? "page" : undefined}
            className={linkClass("catalog")}
          >
            Catalog
          </Link>
          {canViewOrders(user) ? (
            <Link
              to="/orders"
              aria-current={activeSection === "orders" ? "page" : undefined}
              className={linkClass("orders")}
            >
              Orders
            </Link>
          ) : null}
          {can(user, "orders:own-patients") ? (
            <Link
              to="/patients"
              aria-current={activeSection === "patients" ? "page" : undefined}
              className={linkClass("patients")}
            >
              Patients
            </Link>
          ) : null}
          {GATED_SECTIONS.filter((s) =>
            s.permissions.some((p) => can(user, p)),
          ).map((s) => (
            <span
              key={s.label}
              className="cursor-default text-ink-2"
              title="Coming soon"
            >
              {s.label}
            </span>
          ))}
        </nav>
      </div>

      <NavSearch user={user} />

      <div className="flex shrink-0 items-center gap-3 justify-self-end">
        <button
          type="button"
          onClick={onOpenCart}
          aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          data-testid="cart-button"
          className="p-1 text-ink transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:opacity-70 active:scale-95"
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              className="fill-current"
              stroke="none"
              d="M7.5 10.5h19l-2.2 10.2a2 2 0 0 1-2 1.6H11.4a2 2 0 0 1-2-1.6L7.5 10.5Z"
            />
            <path d="M7.5 10.5 6.2 6.8H3.5" />
            <circle cx="12.5" cy="26.7" r="1.7" />
            <circle cx="22" cy="26.7" r="1.7" />
            <text
              x="16.9"
              y="16.6"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10.5"
              fontWeight="700"
              stroke="none"
              className="fill-bg"
            >
              {cartCount > 99 ? "99" : cartCount}
            </text>
          </svg>
        </button>

        <ProfileMenu user={user} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

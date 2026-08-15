import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { can, isFamilyMember, type Permission } from "../../lib/auth";
import { RESET_CATALOG_FILTERS_STATE } from "../../lib/catalog";
import type { User } from "../../types/domain";
import { Logo } from "../ui/Logo";
import { Tooltip } from "../ui/Tooltip";
import { NavSearch } from "./NavSearch";
import { ProfileMenu } from "./ProfileMenu";

// "dashboard" isn't one of this bar's own links — it's reached from the profile menu — but views
// still pass it as activeSection so linkClass() has a real, never-matching value instead of a lie.
export type NavSection = "catalog" | "orders" | "patients" | "assignments" | "dashboard";

/** Placeholder sections, shown only to roles whose permissions will unlock them when built. */
const GATED_SECTIONS: { label: string; permissions: Permission[] }[] = [
  { label: "Vendors", permissions: ["vendors:manage"] },
];

const canViewOrders = (user: User): boolean =>
  can(user, "orders:all") || can(user, "orders:own-patients") || can(user, "orders:own");

/**
 * Contextual search for the non-storefront sections. The catalog uses the <NavSearch> AI bar
 * (order commands, AI ranking); everywhere else, search means "filter this list", so those
 * sections keep a plain search-in-place form that filters as you type.
 */
const CONTEXTUAL_SEARCH: Record<
  Exclude<NavSection, "catalog" | "dashboard">,
  { path: string; placeholder: string; label: string }
> = {
  orders: {
    path: "/orders",
    placeholder: "Search orders, patients, or MRN…",
    label: "Search orders",
  },
  patients: {
    path: "/patients",
    placeholder: "Search patients or MRN…",
    label: "Search patients",
  },
  assignments: {
    path: "/assignments",
    placeholder: "Search patients or MRN…",
    label: "Search patients",
  },
};

function ContextualSearch({ section }: { section: Exclude<NavSection, "catalog" | "dashboard"> }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const { path, placeholder, label } = CONTEXTUAL_SEARCH[section];

  // Keep the input in step when the URL's q changes underneath us (back button, cleared search).
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  // Push the query into the URL so the view filters. `replace` on live typing keeps the back
  // button clean; Enter pushes a real history entry.
  const runSearch = (raw: string, replace: boolean) => {
    const q = raw.trim();
    navigate(q ? `${path}?q=${encodeURIComponent(q)}` : path, { replace });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        runSearch(query, false);
      }}
      role="search"
      className="flex w-full min-w-0 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 py-2 text-ink-3 transition-colors focus-within:border-ink"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          runSearch(e.target.value, true);
        }}
        placeholder={placeholder}
        aria-label={label}
        className="w-full min-w-0 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
      />
    </form>
  );
}

/** Mobile-only hamburger. Opens a dropdown of the same section links the desktop bar shows. */
function MobileNavMenu({
  items,
  activeSection,
}: {
  items: { to?: string; label: string; section?: NavSection; state?: unknown }[];
  activeSection: NavSection;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative lg:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
        className="-ml-1 flex h-8 w-8 items-center justify-center text-ink transition-colors hover:text-ink-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          ) : (
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="profile-menu-panel absolute left-0 top-[calc(100%+12px)] z-30 w-56 rounded-panel border border-line bg-surface p-1.5 shadow-lg"
        >
          {items.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                state={item.state}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={item.section === activeSection ? "page" : undefined}
                className={`block rounded-control px-3 py-2.5 text-[13px] transition-colors hover:bg-hover ${
                  item.section === activeSection ? "text-ink" : "text-ink-2"
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <div
                key={item.label}
                role="menuitem"
                aria-disabled="true"
                title="Coming soon"
                className="flex cursor-default items-center justify-between rounded-control px-3 py-2.5 text-[13px] text-ink-2"
              >
                {item.label}
                <span className="text-[10px] uppercase tracking-[0.09em] text-ink-3">Soon</span>
              </div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Sticky app header: brand, section nav, search (catalog AI bar or contextual), cart, profile. */
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

  // One source of truth for the section links, rendered by both the desktop bar and the
  // mobile menu so the two can't drift. Gated ("Coming soon") entries carry no route.
  const navItems: { to?: string; label: string; section?: NavSection; state?: unknown }[] = [
    { to: "/catalog", label: "Catalog", section: "catalog", state: RESET_CATALOG_FILTERS_STATE },
    ...(isFamilyMember(user)
      ? [{ to: "/family", label: "My family member", section: "patients" as NavSection }]
      : []),
    ...(canViewOrders(user) ? [{ to: "/orders", label: "Orders", section: "orders" as NavSection }] : []),
    ...(can(user, "orders:own-patients")
      ? [{ to: "/patients", label: "Patients", section: "patients" as NavSection }]
      : []),
    ...(can(user, "nurse-assignment")
      ? [{ to: "/assignments", label: "Assignments", section: "assignments" as NavSection }]
      : []),
    ...GATED_SECTIONS.filter((s) => s.permissions.some((p) => can(user, p))).map((s) => ({
      label: s.label,
    })),
  ];

  return (
    <header className="sticky top-0 z-20 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-b border-line bg-bg/92 px-4 py-3 backdrop-blur-sm [grid-template-areas:'brand_actions''search_search'] lg:grid-cols-[1fr_minmax(0,520px)_1fr] lg:gap-6 lg:px-8 lg:py-3.5 lg:[grid-template-areas:'brand_search_actions']">
      <div className="flex items-center gap-3 [grid-area:brand] lg:gap-6">
        <MobileNavMenu items={navItems} activeSection={activeSection} />

        <div className="shrink-0 text-ink">
          <Logo height={26} />
        </div>

        <nav className="hidden shrink-0 gap-6 text-xs uppercase tracking-[0.09em] text-ink-2 lg:flex">
          {navItems.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                state={item.state}
                aria-current={item.section === activeSection ? "page" : undefined}
                className={item.section ? linkClass(item.section) : "nav-link text-ink-2"}
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className="cursor-default text-ink-2" title="Coming soon">
                {item.label}
              </span>
            ),
          )}
        </nav>
      </div>

      <div className="min-w-0 [grid-area:search]">
        {activeSection === "catalog" ? (
          <NavSearch user={user} />
        ) : isFamilyMember(user) || activeSection === "dashboard" ? (
          // The family home and the cost dashboard have no searchable list — leave the slot empty.
          <div aria-hidden />
        ) : (
          <ContextualSearch section={activeSection} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 justify-self-end [grid-area:actions]">
        <Tooltip label={`Cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
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
        </Tooltip>

        <ProfileMenu user={user} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

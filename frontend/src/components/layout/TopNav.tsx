const OTHER_SECTIONS = ['Orders', 'Vendors', 'Pickups'] as const;

/** Sticky app header: brand, section nav, org/user identity, and the cart toggle. */
export function TopNav({
  hospiceName,
  userName,
  cartCount,
  onOpenCart,
}: {
  hospiceName: string;
  userName: string;
  cartCount: number;
  onOpenCart: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-[var(--color-line)] bg-white/92 px-8 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
        <span className="h-2.5 w-2.5 flex-none rounded-full bg-[var(--color-ink)]" />
        BetterRx
      </div>

      <nav className="flex gap-6 text-xs uppercase tracking-[0.09em] text-[var(--color-ink-3)]">
        <span aria-current="page" className="text-[var(--color-ink)]">
          Catalog
        </span>
        {OTHER_SECTIONS.map((label) => (
          <span key={label} className="cursor-default" title="Coming soon">
            {label}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-4.5">
        <div className="text-xs text-[var(--color-ink-3)]">
          {hospiceName} · {userName}
        </div>
        <button
          type="button"
          onClick={onOpenCart}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] uppercase tracking-[0.09em] transition-colors hover:border-[var(--color-ink)] ${
            cartCount > 0
              ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
              : 'border-[var(--color-line-strong)] bg-white text-[var(--color-ink-2)]'
          }`}
        >
          Cart
          <span className="font-mono tabular-nums opacity-75">{cartCount}</span>
        </button>
      </div>
    </header>
  );
}

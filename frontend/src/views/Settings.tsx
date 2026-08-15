import { getHospice } from '../data/db';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { TopNav } from '../components/layout/TopNav';
import type { User } from '../types/domain';

export default function Settings({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const hospice = getHospice(user.orgId);
  const { cartCount, setCartOpen } = useCart();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        hospiceName={hospice?.name ?? 'Hospice'}
        user={user}
        cartCount={cartCount}
        activeSection="settings"
        onOpenCart={() => setCartOpen(true)}
        onSignOut={onSignOut}
      />

      <main className="mx-auto max-w-[1220px] px-8 pb-20 pt-6.5">
        <h1 className="text-[22px] font-semibold tracking-tight">Settings</h1>

        <section className="mt-8 max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h2 className="text-[15px] font-medium">Color mode</h2>
              <p className="mt-1 text-[13px] text-[var(--color-ink-2)]">
                Switch between light and dark appearance.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Dark mode on' : 'Light mode on'}
              data-testid="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
                theme === 'dark'
                  ? 'border-[var(--color-ink)] bg-solid-bg'
                  : 'border-[var(--color-line-strong)] bg-track'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5.5 w-5.5 rounded-full bg-surface shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <p className="mt-4 text-xs text-[var(--color-ink-3)]">
            Currently using <span className="font-medium text-[var(--color-ink-2)]">{theme} mode</span>.
          </p>
        </section>
      </main>
    </div>
  );
}

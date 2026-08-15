import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { isFamilyMember, ROLE_LABELS } from '../../lib/auth';
import { familyCardLabel } from '../../lib/family';
import type { User } from '../../types/domain';
import { Tooltip } from '../ui/Tooltip';

/** "Jordan Reyes" → "JR". Falls back to "?" so a blank name can't render an empty circle. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Avatar button with the signed-in user's initials; opens the account dropdown. */
export function ProfileMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Tooltip label="Account menu" hidden={open}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          data-testid="profile-menu-button"
          onClick={() => setOpen((v) => !v)}
          className={`flex h-9 w-9 items-center justify-center rounded-full border text-[12px] font-semibold tracking-wide transition-colors ${
            open
              ? 'border-ink bg-solid-bg text-solid-ink'
              : 'border-line-strong bg-surface text-ink hover:border-ink'
          }`}
        >
          {initialsOf(user.name)}
        </button>
      </Tooltip>

      {open ? (
        <div
          role="menu"
          data-testid="profile-menu"
          className="profile-menu-panel absolute right-0 top-[calc(100%+10px)] z-30 w-60 rounded-panel border border-line bg-surface p-1.5 shadow-lg"
        >
          <div className="px-3 pb-2.5 pt-2">
            <div className="text-[13px] font-medium text-ink">{user.name}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.09em] text-ink-3">
              {ROLE_LABELS[user.role]}
            </div>
          </div>

          <div className="mx-1.5 border-t border-line" />

          {isFamilyMember(user) ? (
            <div
              data-testid="family-payment"
              className="mt-1.5 flex items-center justify-between rounded-control px-3 py-2 text-[13px] text-ink"
            >
              <span className="text-ink-2">Payment method</span>
              <span className="font-mono text-[12px] tabular-nums">{familyCardLabel}</span>
            </div>
          ) : null}

          <button
            type="button"
            role="menuitem"
            data-testid="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="mt-1.5 flex w-full items-center justify-between rounded-control px-3 py-2 text-[13px] text-ink transition-colors hover:bg-hover"
          >
            Dark mode
            <span
              role="switch"
              aria-checked={theme === 'dark'}
              className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                theme === 'dark' ? 'border-ink bg-solid-bg' : 'border-line-strong bg-track'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-surface shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            data-testid="log-out"
            onClick={onSignOut}
            className="mt-0.5 block w-full rounded-control px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-hover"
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

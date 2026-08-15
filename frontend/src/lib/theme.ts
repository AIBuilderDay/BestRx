/** Persisted light/dark preference. CSS tokens swap via `data-theme` on `<html>`. */

export type Theme = 'light' | 'dark';

const THEME_KEY = 'bestrx.theme';

export const getStoredTheme = (): Theme | null => {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
};

export const getPreferredTheme = (): Theme => {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyTheme = (theme: Theme): void => {
  document.documentElement.setAttribute('data-theme', theme);
};

export const setStoredTheme = (theme: Theme): void => {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Preference just won't survive a refresh.
  }
  applyTheme(theme);
};

/** Call once before React mounts to avoid a flash of the wrong theme. */
export const applyStoredTheme = (): void => {
  applyTheme(getPreferredTheme());
};

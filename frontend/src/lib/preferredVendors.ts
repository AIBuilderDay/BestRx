/**
 * "Use this vendor" from the Potential Savings card sets which vendor the Catalog should badge as
 * preferred for that HCPCS code. Session-local, same pattern as nurse reassignments in
 * lib/assignments.ts — honest about living in the browser, but it survives a reload.
 */

export type PreferredVendorMap = Record<string, string>;

const STORAGE_KEY = 'bestrx.preferredVendors';

/** Browser-local vendor preferences, keyed by HCPCS code. localStorage may be unavailable (private mode). */
export function readPreferredVendors(): PreferredVendorMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PreferredVendorMap) : {};
  } catch {
    return {};
  }
}

export function writePreferredVendors(prefs: PreferredVendorMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // The preference just won't survive a reload.
  }
}

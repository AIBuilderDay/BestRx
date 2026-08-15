/**
 * Loads every table from the API once, before the app renders.
 *
 * The pure helpers in `src/lib/` do synchronous lookups mid-computation, so the data has to be in
 * place before any view mounts. This gate is what makes that safe: children render only after
 * `fetchSnapshot` resolves.
 *
 * There is no fixture fallback. A failed load shows an error with a retry rather than quietly
 * falling back to bundled JSON, so a broken backend never looks like a working one.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setSnapshot } from '../data/store';
import { fetchSnapshot } from '../lib/api';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { ErrorState } from '../components/ui/DataStates';

type Status = 'loading' | 'ready' | 'error';

interface DataContextValue {
  /** Re-fetch every table. Used by the error retry and after a write that changes many rows. */
  reload: () => void;
}

const DataContext = createContext<DataContextValue>({ reload: () => {} });

export const useData = (): DataContextValue => useContext(DataContext);

export function DataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    setError(undefined);

    fetchSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setSnapshot(snapshot);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(load, [load]);

  if (status === 'loading') return <LoadingIndicator label="Loading BestRx…" />;

  if (status === 'error') {
    return <ErrorState title="Could not load BestRx" message={error} onRetry={load} />;
  }

  return <DataContext.Provider value={{ reload: load }}>{children}</DataContext.Provider>;
}

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
import { applyOrderStatus, setSnapshot } from '../data/store';
import { fetchSnapshot } from '../lib/api';
import { useOrderStream } from '../hooks/useOrderStream';
import type { OrderStatus } from '../types/domain';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { ErrorState } from '../components/ui/DataStates';

type Status = 'loading' | 'ready' | 'error';

interface DataContextValue {
  /** Re-fetch every table. Used by the error retry and after a write that changes many rows. */
  reload: () => void;
  /**
   * Bumped whenever a live event mutates the snapshot. The tables live outside React, so a view
   * that derives from them puts this in its `useMemo` deps to recompute when they change.
   */
  version: number;
}

const DataContext = createContext<DataContextValue>({ reload: () => {}, version: 0 });

export const useData = (): DataContextValue => useContext(DataContext);

export function DataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);

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

  // Live status changes, over SSE. Enabled only once the tables are in place — an event that
  // arrives before them has no order to patch and would be dropped.
  const handleUpdate = useCallback((update: { orderId: string; status: OrderStatus; at: string }) => {
    if (applyOrderStatus(update.orderId, update.status, update.at)) {
      setVersion((current) => current + 1);
    }
  }, []);

  useOrderStream({ enabled: status === 'ready', onUpdate: handleUpdate });

  if (status === 'loading') return <LoadingIndicator label="Loading BestRx…" />;

  if (status === 'error') {
    return <ErrorState title="Could not load BestRx" message={error} onRetry={load} />;
  }

  return (
    <DataContext.Provider value={{ reload: load, version }}>{children}</DataContext.Provider>
  );
}

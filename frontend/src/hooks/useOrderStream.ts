/**
 * Live order status, over SSE.
 *
 * The live half of the notification story: this updates a tab that is open. Web Push covers the tab
 * that is not — see `lib/push.ts`.
 *
 * Two sources feed the same callback:
 *  - the EventSource, while the tab is open
 *  - the Service Worker, which forwards a push it received (a tab can be open but backgrounded)
 *
 * Both are deduplicated by `seq`, the monotonic counter the backend stamps on every event, so an
 * event that arrives down both paths is applied once.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderEvent, OrderStatus } from '../types/domain';

const SSE_URL = import.meta.env.VITE_SSE_URL ?? '';

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'unavailable';

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  at: string;
  seq: number;
  detail: string;
}

interface Options {
  hospiceId?: string;
  /** Called once per distinct event, in arrival order. */
  onUpdate?: (update: OrderStatusUpdate) => void;
  enabled?: boolean;
}

/** Backoff between reconnects, capped so a long outage does not stop retrying. */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function useOrderStream({ hospiceId, onUpdate, enabled = true }: Options = {}): {
  status: StreamStatus;
  lastUpdate: OrderStatusUpdate | null;
} {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [lastUpdate, setLastUpdate] = useState<OrderStatusUpdate | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<number | undefined>(undefined);
  const attemptsRef = useRef(0);
  /** Highest seq already applied. Guards against replay after a reconnect. */
  const cursorRef = useRef(0);
  const seenRef = useRef<Set<number>>(new Set());

  // Held in a ref so a caller passing an inline function does not tear down the connection on
  // every render.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const apply = useCallback((update: OrderStatusUpdate) => {
    if (seenRef.current.has(update.seq)) return;

    seenRef.current.add(update.seq);
    cursorRef.current = Math.max(cursorRef.current, update.seq);
    setLastUpdate(update);
    onUpdateRef.current?.(update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!SSE_URL) {
      setStatus('unavailable');
      return;
    }

    let cancelled = false;

    const connect = (): void => {
      if (cancelled) return;

      setStatus(attemptsRef.current === 0 ? 'connecting' : 'reconnecting');

      const url = new URL(SSE_URL);
      if (hospiceId) url.searchParams.set('hospiceId', hospiceId);
      // Resume where we left off. The browser also sends Last-Event-ID automatically, but that is
      // lost when we construct a fresh EventSource ourselves.
      if (cursorRef.current > 0) url.searchParams.set('since', String(cursorRef.current));

      const source = new EventSource(url.toString());
      sourceRef.current = source;

      source.addEventListener('connected', () => {
        if (cancelled) return;
        attemptsRef.current = 0;
        setStatus('open');
      });

      source.addEventListener('order-status', (event) => {
        if (cancelled) return;
        try {
          const orderEvent = JSON.parse((event as MessageEvent).data) as OrderEvent & {
            seq: number;
          };
          apply({
            orderId: orderEvent.orderId,
            status: orderEvent.event as OrderStatus,
            at: orderEvent.at,
            seq: orderEvent.seq,
            detail: orderEvent.detail,
          });
        } catch (error) {
          console.warn('Could not parse an order event.', error);
        }
      });

      // The Lambda closes itself before its 15-minute ceiling. An expected close, not a failure.
      source.addEventListener('reconnect', () => {
        source.close();
        if (!cancelled) connect();
      });

      source.onerror = () => {
        source.close();
        if (cancelled) return;

        setStatus('reconnecting');
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** attemptsRef.current,
          RECONNECT_MAX_MS,
        );
        attemptsRef.current += 1;
        reconnectRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectRef.current);
      sourceRef.current?.close();
      sourceRef.current = null;
      setStatus('idle');
    };
  }, [hospiceId, enabled, apply]);

  // A push that arrived while this tab was backgrounded reaches us through the Service Worker.
  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent): void => {
      const message = event.data as {
        type?: string;
        payload?: { orderId?: string; status?: string; seq?: number };
      };
      if (message?.type !== 'order-status' || !message.payload?.orderId) return;

      apply({
        orderId: message.payload.orderId,
        status: message.payload.status as OrderStatus,
        at: new Date().toISOString(),
        seq: message.payload.seq ?? 0,
        detail: '',
      });
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [enabled, apply]);

  return { status, lastUpdate };
}

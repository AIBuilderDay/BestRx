/**
 * The account-menu switch for Web Push delivery alerts.
 *
 * Lives behind a click for a reason: browsers reject a permission prompt that is not tied to a user
 * gesture, and an unprompted one is the fastest way to get permanently denied. The switch reflects
 * the live subscription rather than a stored preference, so revoking permission in browser settings
 * shows up here on the next open.
 */

import { useEffect, useState } from 'react';
import {
  pushSupport,
  pushUnavailableMessage,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../lib/push';
import type { User } from '../../types/domain';

type State = 'checking' | 'on' | 'off' | 'unavailable' | 'working';

export function PushAlertsToggle({ user }: { user: User }) {
  const [state, setState] = useState<State>('checking');
  const [note, setNote] = useState<string>();

  // Read the actual subscription on mount. A stored flag would drift from the browser's own state.
  useEffect(() => {
    let cancelled = false;

    const support = pushSupport();
    if (!support.supported) {
      setState('unavailable');
      setNote(pushUnavailableMessage(support.reason));
      return;
    }

    // Register up front rather than waiting for the first toggle: on a freshly installed iOS PWA
    // there is no registration yet, and reading the subscription is what tells us the real state.
    //
    // The race is deliberate. On iOS `getSubscription()` can stay pending forever on a cold PWA
    // launch — it never resolves and never rejects — which would strand this in `checking`, the
    // state that renders the switch disabled with no explanation. Falling back to `off` keeps the
    // control usable; the tap itself re-checks and subscribes.
    const readSubscription = registerServiceWorker()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => Boolean(subscription) && Notification.permission === 'granted');

    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000));

    Promise.race([readSubscription, timeout])
      .then((subscribed) => {
        if (!cancelled) setState(subscribed ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setState('off');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (): Promise<void> => {
    if (state === 'working' || state === 'unavailable' || state === 'checking') return;

    const turningOn = state === 'off';
    setState('working');
    setNote(undefined);

    if (turningOn) {
      const result = await subscribeToPush(user.orgId, user.id);
      setState(result.ok ? 'on' : 'off');
      if (!result.ok) setNote(result.reason);
      return;
    }

    await unsubscribeFromPush();
    setState('off');
  };

  const enabled = state === 'on';
  const disabled = state === 'unavailable' || state === 'checking' || state === 'working';

  return (
    <>
      <button
        type="button"
        role="menuitem"
        data-testid="push-alerts-toggle"
        onClick={() => void toggle()}
        disabled={disabled}
        title={state === 'unavailable' ? note : undefined}
        className="mt-0.5 flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-hover disabled:opacity-45"
      >
        Delivery alerts
        <span
          role="switch"
          aria-checked={enabled}
          className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
            enabled ? 'border-ink bg-solid-bg' : 'border-line-strong bg-track'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-surface shadow-sm transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </span>
      </button>

      {/* Why it failed, in the nurse's words — iOS needs the app on the Home Screen first. */}
      {note && state !== 'unavailable' ? (
        <p className="px-3 pb-1 pt-0.5 text-[11px] leading-snug text-ink-3">{note}</p>
      ) : null}
    </>
  );
}

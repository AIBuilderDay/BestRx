/**
 * Browser push subscription.
 *
 * The frontend owns two ends of Web Push: subscribing (here) and rendering the notification (the
 * Service Worker). It cannot send one — that needs the VAPID private key and a process that is
 * awake, which is the whole reason the push Lambda exists.
 *
 * On iOS this only works once the site has been added to the Home Screen (iOS 16.4+). `pushSupport`
 * reports that case separately so the ordering flow can tell the user what to do rather than
 * failing silently.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: 'unsupported' | 'needs-home-screen' | 'no-backend' };

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports as a Mac. `platform` is deprecated and may be empty, so treat any Mac-like UA
  // with a touchscreen as an iPad — a real Mac reports maxTouchPoints 0.
  (/macintosh|mac os x/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** iOS delivers push only to an installed PWA, never to a plain Safari tab. */
const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone));

export function pushSupport(): PushSupport {
  if (!BASE_URL) return { supported: false, reason: 'no-backend' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, reason: 'unsupported' };
  }
  if (isIos() && !isStandalone()) {
    return { supported: false, reason: 'needs-home-screen' };
  }
  return { supported: true };
}

/** What to tell the user when push is not available. */
export function pushUnavailableMessage(reason: Exclude<PushSupport, { supported: true }>['reason']): string {
  switch (reason) {
    case 'needs-home-screen':
      return 'To get delivery alerts on iPhone, tap Share and choose "Add to Home Screen", then open BestRx from there.';
    case 'unsupported':
      return 'This browser cannot show delivery alerts. Order status still updates while this page is open.';
    case 'no-backend':
      return 'Delivery alerts need a deployed backend.';
  }
}

/** The VAPID public key arrives as URL-safe base64; PushManager wants raw bytes. */
function decodeVapidKey(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);

  // An ArrayBuffer rather than a Uint8Array: applicationServerKey rejects a view whose backing
  // buffer might be shared.
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.warn('Service worker registration failed; push is unavailable.', error);
    return undefined;
  }
}

export interface SubscribeResult {
  ok: boolean;
  reason?: string;
}

/**
 * Ask permission, subscribe, and register the subscription with the backend.
 *
 * Call this from a user gesture. Browsers reject a permission prompt that is not tied to one, and
 * an unprompted prompt is the fastest way to get permanently denied.
 */
export async function subscribeToPush(hospiceId?: string, userId?: string): Promise<SubscribeResult> {
  const support = pushSupport();
  if (!support.supported) {
    return { ok: false, reason: pushUnavailableMessage(support.reason) };
  }

  const registration = await registerServiceWorker();
  if (!registration) return { ok: false, reason: 'Service worker unavailable.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Notification permission was denied.' };
  }

  try {
    const keyResponse = await fetch(`${BASE_URL}/push/public-key`);
    if (!keyResponse.ok) {
      return { ok: false, reason: 'Push is not configured on the server yet.' };
    }
    const { publicKey } = (await keyResponse.json()) as { publicKey: string };

    // Reuse an existing subscription rather than creating a duplicate row per page load.
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        // Required by every browser: a push must always be shown to the user.
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      }));

    const payload = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
    const response = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: payload.endpoint,
        keys: payload.keys,
        hospiceId,
        userId,
      }),
    });

    if (!response.ok) return { ok: false, reason: 'Could not register for alerts.' };
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Push subscription failed.', message);
    return { ok: false, reason: message };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  // Tell the backend first: an endpoint we can no longer reach is one we can never clean up.
  try {
    await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (error) {
    console.warn('Could not deregister the push subscription on the server.', error);
  }

  await subscription.unsubscribe();
}

/**
 * Service Worker: the receiving end of Web Push.
 *
 * This is the only code that runs while the phone is asleep. The OS wakes it for a few seconds to
 * handle a `push` event, it renders a notification, and it goes back to sleep. It can only ever
 * receive — it cannot originate a push.
 *
 * Built to `public/sw.js` by `vite build`, so it is a real TypeScript module, not a hand-written .js
 * file (see CLAUDE.md).
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  data?: {
    orderId?: string;
    status?: string;
    seq?: number;
    url?: string;
  };
}

/** Take over open tabs immediately rather than waiting for every one of them to close. */
self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Whether a tab is on screen right now.
 *
 * If one is, SSE has already updated the UI and an OS notification would be redundant — so we hand
 * the event to the page instead of raising one. This is what stops a double-notify.
 */
async function hasVisibleClient(): Promise<boolean> {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return clients.some((client) => client.visibilityState === 'visible');
}

async function handlePush(payload: NotificationPayload): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  // Let any open tab apply the update, whether or not it is the visible one.
  for (const client of clients) {
    client.postMessage({ type: 'order-status', payload: payload.data });
  }

  if (await hasVisibleClient()) return;

  await self.registration.showNotification(payload.title, {
    body: payload.body,
    // One line per order: a later update for the same order replaces the earlier one rather than
    // stacking up on the lock screen.
    tag: payload.tag ?? 'bestrx',
    // `renotify` makes a replacement still buzz the phone — without it a tagged update lands
    // silently, which defeats the point of waking someone. It is in the Notifications spec but
    // missing from TypeScript's DOM lib, hence the cast.
    renotify: true,
    icon: '/images/icon-192.png',
    badge: '/images/badge-72.png',
    data: payload.data ?? {},
  } as NotificationOptions & { renotify: boolean });
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: NotificationPayload;
  try {
    payload = event.data.json() as NotificationPayload;
  } catch {
    // A push with an unreadable body still has to show something — userVisibleOnly requires it.
    payload = { title: 'BestRx', body: event.data.text() };
  }

  event.waitUntil(handlePush(payload));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data as NotificationPayload['data'];
  const target = data?.url ?? '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Focus a tab that is already open rather than opening a second copy of the app.
      for (const client of clients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'navigate', url: target });
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});

export {};

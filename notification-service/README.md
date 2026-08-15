# notification-service

Web Push delivery for order status changes. Separate from the backend, fronted by a queue, deployed
to AWS Lambda.

```
backend (EC2)              this service (AWS)
     │                            │
     │  PATCH /orders/{id}/status │
     ├── SSE to open tabs         │
     └── SQS ────────────────────►│  push Lambda
                                  │      │ VAPID-signed POST
                                  │      ▼
                                  │  FCM / Apple / Mozilla
                                  │      │
                                  │      ▼
                                  │  Service Worker → OS notification
                                  │     (phone asleep ✓)
```

## Why it is separate

**Different failure modes.** Sending a push is an outbound HTTPS call to a third party that can rate
limit, time out, or go down. The order API must not inherit that. It enqueues one message and
returns; nothing about a slow FCM can make an order update slow.

**Different load shapes.** Status changes arrive in bursts. A queue absorbs them, retries what
fails, and drops what fails repeatedly into a DLQ — none of which the API has to know about.

**Different compute.** This is idle most of the time and bursty when it is not, which is exactly what
Lambda is good at. The API holds SSE connections open, which Lambda cannot do at all. Each side gets
the model that fits.

## Why the frontend cannot do this

Web Push lets a page **subscribe** — it returns an endpoint URL and encryption keys. It does not let
a page **send**. Delivering a push is an HTTP POST to that endpoint signed with a VAPID private key,
and it has to originate somewhere that is awake.

Two blockers, either fatal alone:

1. **The private key would be public.** Shipped to the browser, anyone could push to every user.
2. **Nothing is running on a sleeping phone.** That is the requirement itself — no JavaScript
   context exists there to execute a `fetch`.

The Service Worker *does* run while the phone sleeps: the OS wakes it for a few seconds to handle
the `push` event. But it only ever receives.

## Layout

```
handler.py            the Lambda: SQS in, Web Push out
scripts/build.sh      builds the deployment package
scripts/generate_vapid.py
tests/
```

## What the handler does

1. Reads one status change off SQS
2. Loads every push subscription for that hospice from DynamoDB
3. Builds a notification from the event — no invented facts, every field traces to the order
4. Signs with VAPID and POSTs to each browser's push endpoint

**A 404 or 410 means the subscription is dead** (browser uninstalled, permission revoked), so the row
is deleted. Without this the table fills with garbage and every send wastes a call.

**Partial batch failure** is reported through `batchItemFailures`, so one bad message is retried
alone instead of replaying the whole batch and notifying everyone in it twice.

A message that fails three times lands in `bestrx-push-dlq`. A CloudWatch alarm watches it.

## Local development

```bash
uv venv --python 3.12
uv pip install -e ".[dev]"
task test:notifications
```

Covered: the notification payload, that a STAT order is marked in the title, that repeat updates for
one order collapse to a single line rather than stacking on a lock screen, that a dead subscription
is deleted rather than retried forever, that one unreachable endpoint does not block the others, and
that malformed JSON goes to the DLQ instead of retrying.

## Deploying

Part of the Terraform stack:

```bash
task infra:build    # builds this package
task infra:apply
task infra:vapid    # generates the keypair into Secrets Manager, once
```

See [../infra/README.md](../infra/README.md).

## VAPID keys

`scripts/generate_vapid.py` writes the keypair straight into Secrets Manager. **The private key
never enters Terraform state, an environment variable, or this repo.** The public key is printed
because the frontend needs it to subscribe.

Re-running rotates the pair, which invalidates every existing browser subscription — hence the
`--force` guard.

The `sub` claim (`mailto:ylim.8299+bestrx-vapid@gmail.com`) is operational contact info for push
services only. Never shown to users, never verified.

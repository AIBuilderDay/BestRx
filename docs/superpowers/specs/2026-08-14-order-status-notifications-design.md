# Order status notifications — design

**Date:** 2026-08-14
**Status:** implemented, with amendments

> **Amended 2026-08-15.** The API moved from Lambda to a container on EC2, which let SSE move
> in-process and removed DynamoDB for orders. §4-§6 below describe the original Lambda design; see
> [infra/README.md](../../../infra/README.md) for what is actually built. The reasoning in §3 (why
> the frontend cannot send push) and the two-channel argument in §1 are unchanged and still the
> point of the whole design.
>
> What changed and why:
> - **SSE is served by FastAPI, not its own Lambda.** A Lambda holds one invocation per open
>   connection and caps at 15 minutes; a container holds thousands of idle sockets on almost no CPU.
>   The crossover is around 25-30 concurrent viewers, so Lambda was the worse scaler for exactly this
>   workload. In-process fan-out also removed the ~2s poll latency.
> - **The API is a container on EC2.** Forced by the above: API Gateway caps responses at 30s and
>   does not stream, so SSE cannot live behind it.
> - **DynamoDB is down to one table.** A long-running process holds orders in memory, so only push
>   subscriptions — the state shared with the Lambda — still need storage.
> - **Push moved to `notification-service/`.** It was nested inside `backend/`, which contradicted
>   the separation the design argues for.

A serverless backend and notification path so that when an order's status changes, the nurse's
open tab updates live and their phone raises an OS notification even while asleep.

---

## 1. Problem

Today BestRx is frontend-only. Every view reads the JSON fixtures in `frontend/src/data/` through
`db.ts`. Nothing changes after page load, and nothing reaches a nurse who is not looking at the
screen.

The delivery story the bounty asks for needs two things the current app cannot do:

- **Live status.** A driver marks an order `in_transit`; the case manager's board reflects it
  without a refresh.
- **Out-of-band notification.** The same event wakes a field nurse's phone when the tab is closed
  and the device is asleep.

These are different problems with different solutions, and conflating them is the main design
trap. A live connection dies when the tab closes. A push notification is the only mechanism that
survives a sleeping device.

---

## 2. Constraints

| Constraint | Source |
|---|---|
| All notification infrastructure serverless, in AWS, via Terraform | user |
| Notification service separate from the API, queue-fronted, absorbs bursts | user |
| Backend is FastAPI (Python) | user |
| Region `us-east-2`, profile `default`, local Terraform state | user |
| Resource prefix `bestrx`, overridable as a variable | user |
| No Fargate — Lambda only | user |
| iOS "Add to Home Screen" is instructed in the ordering UI, not built as an install prompt | user |
| TypeScript only in `frontend/src/` | CLAUDE.md |
| No invented clinical or vendor facts in the UI | CLAUDE.md |
| All changes ship through a PR | CLAUDE.md |

---

## 3. Why the frontend cannot send push

Stated here because it drove the whole shape of this design.

The Web Push API lets a page **subscribe** — it returns a `PushSubscription` (an endpoint URL plus
encryption keys). It does not let a page **send**. Delivering a push is an HTTP POST to that
endpoint signed with a **VAPID private key**, and it must originate somewhere that is awake.

Two independent blockers, either fatal on its own:

1. **The VAPID private key would be public.** Shipped to the browser, anyone could push to every
   user. It is an asymmetric signing key and must stay server-side.
2. **Nothing is running on a sleeping phone.** That is the requirement itself. No JavaScript
   context exists to execute a `fetch`.

The Service Worker *does* execute while the phone sleeps — the OS wakes it for a few seconds to
handle the `push` event and call `showNotification()`. But it only ever receives. It cannot
originate a push.

So the frontend owns both ends (subscribe, render) and the server owns the middle (store, sign,
POST).

---

## 4. Architecture

```
Nurse    POST  /orders
Driver   PATCH /orders/{id}/status
                    │
                    ▼
           API Gateway (HTTP API)
                    │
                    ▼
         FastAPI + Mangum  (Lambda)
                    │
      ┌─────────────┴─────────────┐
      │                           │
      ▼                           ▼
  DynamoDB                    SQS push-queue ──> push Lambda
  orders + events                  (+ DLQ)          │
      │                                             │ VAPID-signed POST
      │                                             ▼
      │                                    Push service (FCM / Apple / Mozilla)
      │                                             │
      │                                             ▼
      │                                    Service Worker wakes
      │                                    → OS notification  (phone asleep ✓)
      ▼
  SSE Lambda (Function URL, response streaming)
  polls the events table
      │
      ▼
  EventSource → UI updates live  (tab open)
```

**Three Lambdas:** the API itself, the push sender, the SSE streamer.

### What is deliberately absent

**SNS.** An earlier draft put an SNS topic in front of two SQS queues feeding two Lambdas. It was
ceremony. The second consumer — a "fanout" Lambda whose only job was copying an event from SQS into
DynamoDB — was writing a row that FastAPI had *already written* while handling the request. Deleting
it left one consumer, and one publisher with one consumer is a plain queue.

SNS becomes correct the moment a second independent consumer appears (audit log, analytics, vendor
webhook), because then the backend should not have to learn about each new one. Not today.

**Fargate.** Rejected as overkill for the traffic. The consequence is that FastAPI cannot serve SSE
itself — API Gateway caps responses at 30s and does not stream — so SSE moved to its own Lambda
Function URL. This is the one place the design pays for the Lambda choice.

---

## 5. Components

### 5.1 Backend API — FastAPI + Mangum on Lambda

One handler behind an API Gateway HTTP API. Mangum adapts ASGI to the Lambda event model.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/orders` | list orders, optional `?hospiceId=&status=&patientId=` |
| `GET` | `/orders/{id}` | single order plus its event timeline |
| `GET` | `/products` | vendor offers joined to the equipment catalog |
| `GET` | `/patients` | patients, optional `?hospiceId=&caseManagerId=` |
| `POST` | `/orders` | create an order |
| `PATCH` | `/orders/{id}/status` | update status — the event that drives notifications |
| `POST` | `/push/subscribe` | store a browser `PushSubscription` |
| `DELETE` | `/push/subscribe` | remove one |
| `GET` | `/health` | liveness |

**`PATCH /orders/{id}/status` is the spine.** In one request it:

1. Validates the transition against the lifecycle in §5.2.
2. Writes the new status to the orders table.
3. Appends an `order_event` row — this row is what SSE serves.
4. Enqueues one SQS message for push.
5. Returns the updated order.

Steps 3 and 4 are the seam: DynamoDB feeds the live channel, SQS feeds the out-of-band channel.
The endpoint never calls a push service directly, so a slow or failing FCM cannot make an order
update slow or fail.

### 5.2 Status lifecycle

Mirrors `OrderStatus` in `frontend/src/types/domain.ts`. Two disjoint tracks:

```
delivery:  ordered → dispatched → in_transit → delivered
pickup:    pickup_triggered → picked_up
```

Transitions outside these edges are rejected with `409`. Rationale: an unvalidated status field
lets a demo click produce a nonsense timeline, and the timeline is the thing judges read.

### 5.3 Persistence — DynamoDB

Lambda is ephemeral, so in-memory writes vanish between invocations. Two tables plus one for
subscriptions:

| Table | PK | SK | Notes |
|---|---|---|---|
| `{prefix}-orders` | `id` | — | seeded from `orders.json` |
| `{prefix}-order-events` | `orderId` | `at` | append-only; GSI `by-seq` on a monotonic `seq` for SSE cursoring |
| `{prefix}-push-subscriptions` | `endpoint` | — | one row per browser subscription |

All on-demand billing — no idle cost, no capacity planning.

**Read-only tables stay as JSON in the deployment package.** `patients`, `vendors`,
`vendor_offers`, `equipment_catalog`, `product_reviews`, `hospices`, `users`, `budgets` are never
written by the API. Copying them into DynamoDB would buy nothing and add seeding complexity. They
ship inside the Lambda bundle and are read at cold start.

**Seeding.** A `seed.py` script writes `orders.json` and `order_events.json` into DynamoDB. Run
once after `terraform apply`, idempotent, re-runnable to reset a demo. Not a Terraform resource —
Terraform provisions, scripts populate.

The `"canonical": true` orders from the bounty organizers are preserved verbatim by the seeder, per
`docs/DATA_MODEL.md`.

### 5.4 Notification service — SQS + push Lambda

**Separate from the API, queue-fronted, independently scalable**, as required.

- **`{prefix}-push-queue`** — standard queue, 30s visibility timeout, `maxReceiveCount` 3
- **`{prefix}-push-dlq`** — failures land here after 3 attempts, 14-day retention
- **push Lambda** — SQS event source, batch size 10, reserved concurrency capped so a burst cannot
  exhaust the account's Lambda pool

Per message the Lambda loads matching subscriptions, builds a payload from the order event, and
POSTs to each endpoint via `pywebpush`, signed with the VAPID private key.

**410 Gone / 404** from a push service means the subscription is dead — the Lambda deletes the row.
Without this the table accumulates garbage and every send wastes a call.

Burst behaviour is the reason the queue exists: FCM rate-limiting or an outage backs messages up in
SQS instead of backpressuring the order API, and retries plus the DLQ come free.

### 5.5 SSE Lambda — Function URL with response streaming

A Lambda Function URL configured with `RESPONSE_STREAM` invoke mode. `GET /stream?hospiceId=…`
holds the connection and emits SSE frames.

Loop: query `order-events` for rows newer than the client's cursor, emit any it finds, sleep ~2s,
repeat. A comment frame every 15s keeps intermediaries from closing an idle connection.

**Honest limits, accepted:**

- **~2s latency** — it is a poll, not a subscription.
- **15-minute cap** — Lambda's hard limit. The Lambda closes cleanly and `EventSource` reconnects
  on its own; the browser sends `Last-Event-ID` and the stream resumes without a gap.
- **One invocation held per connection.** Fine at demo scale, expensive at thousands of concurrent
  clients. Documented in the README rather than engineered around.

Written in TypeScript (Node 22) because response streaming is only supported in the Node runtime,
not Python.

### 5.6 Frontend

**Service Worker** (`frontend/public/sw.ts`, compiled to `sw.js`)

- `push` → if a visible client exists, `postMessage` it; otherwise `showNotification()`. This is
  what prevents a double-notify when the tab is already open and SSE has handled it.
- `notificationclick` → focus an existing tab or open the order detail.

**`useOrderStream` hook** — opens an `EventSource`, applies incoming events to local order state,
reconnects with backoff on error.

**`lib/api.ts` — the fallback seam.** When `VITE_API_BASE_URL` is set the app calls the API; when
it is not, it falls back to the existing `db.ts` fixtures.

This is deliberate. Every view currently imports from `db.ts`. Without a seam the demo breaks
whenever AWS is unreachable or credentials expire — a bad property on judging day. With it,
`pnpm dev` with no env vars behaves exactly as the app does today.

**Manifest.** `manifest.json` ships because a Service Worker must be registered against one for
push to work on iOS at all. No install-prompt UI — per the constraint, the "Add to Home Screen"
instruction is surfaced in the ordering flow by the frontend work, not here.

### 5.7 Secrets

VAPID keys are generated once by a helper script and stored in Secrets Manager as
`{prefix}/vapid`. The push Lambda reads them at cold start; the public key is exposed to the
frontend via `GET /push/public-key`.

**The private key never enters Terraform state, environment variables, or the repo.** Terraform
creates the empty secret; the script populates it out of band.

VAPID `sub` claim: `mailto:ylim.8299+bestrx-vapid@gmail.com`. This is operational contact info for
push services only — never shown to users, never verified.

---

## 6. Terraform layout

```
infra/
├── README.md              apply order, seeding, teardown, cost
├── providers.tf           aws ~> 5.0, region + profile from vars
├── variables.tf           prefix, region, profile, vapid_subject, cors_origins
├── main.tf                module wiring
├── outputs.tf             api_url, sse_url, table names, queue url
├── terraform.tfvars.example
└── modules/
    ├── storage/           3 DynamoDB tables + GSI
    ├── api/               Lambda (FastAPI+Mangum), API Gateway HTTP API, IAM
    ├── notifications/     SQS + DLQ, push Lambda, Secrets Manager, IAM
    └── sse/               Lambda + Function URL (streaming), CORS, IAM
```

Local state per the constraint. `infra/*.tfstate*` and `terraform.tfvars` go in `.gitignore` —
state contains resource metadata that should not be committed.

**Packaging.** Python Lambdas build with `uv pip install --target`, zipped by Terraform's
`archive_file`. The TypeScript SSE Lambda bundles with `esbuild`. A `Taskfile` target wraps both so
`task infra:build` is one command.

**Cost at idle: effectively $0.** DynamoDB on-demand, Lambda scale-to-zero, SQS free tier, Secrets
Manager $0.40/mo. The only meaningful charge is SSE Lambda GB-seconds while connections are held.

---

## 7. Error handling

| Failure | Behaviour |
|---|---|
| Order id not found | `404`, no event written, nothing enqueued |
| Invalid status transition | `409` with the allowed set, nothing enqueued |
| SQS enqueue fails | order update is already committed — log and return `200`. The live channel still works; push is best-effort by design |
| Push service returns 410/404 | delete the subscription row |
| Push send fails otherwise | SQS retries 3×, then DLQ |
| SSE Lambda hits 15min | close cleanly, `EventSource` reconnects with `Last-Event-ID` |
| API unreachable from frontend | `lib/api.ts` falls back to `db.ts` fixtures |
| Push permission denied | app works normally; SSE still updates the UI |

Consistent with `CLAUDE.md`: lookups return `undefined` rather than throwing, and no `undefined`
lookup blanks a view.

---

## 8. Testing

**Backend (pytest):** transition validation including every rejected edge, create-order validation,
event append ordering, that a status change enqueues exactly one message, DynamoDB access mocked
with `moto`.

**Push Lambda (pytest):** payload shape, 410 triggers deletion, malformed message goes to DLQ
rather than crashing the batch.

**Frontend (vitest):** `lib/api.ts` falls back to fixtures with no base URL configured;
`useOrderStream` applies events and reconnects. Existing `db.test.ts` must stay green — the seam
must not change fixture behaviour.

**Manual, before claiming it works:** `terraform apply`, seed, `curl` a PATCH, confirm the SSE
frame arrives in a browser, then confirm an OS notification lands on a locked phone. Per
`CLAUDE.md`, the phone-asleep claim needs the phone-asleep test.

---

## 9. Out of scope

- **Auth.** No authentication on any endpoint — a hackathon demo decision, called out here so it is
  not mistaken for an oversight. Anyone with the URL can PATCH an order. Not shippable beyond a
  demo.
- iOS install-prompt UI (instructed in the ordering flow instead)
- SNS fan-out (§4)
- Vendor-facing or EMR-facing webhooks
- Multi-region, custom domains, CI/CD for `infra/`

---

## 10. Documentation to update in the same PR

- `docs/DATA_MODEL.md` — note that `orders` and `order_events` are served from DynamoDB when the
  API is configured, JSON otherwise
- `CLAUDE.md` repo-layout section — add `infra/` and `backend/`
- `docker-compose.yml` — uncomment and adapt the backend service block that already anticipates
  FastAPI on port 8000
- `infra/README.md` — new: apply order, seeding, VAPID generation, teardown, cost

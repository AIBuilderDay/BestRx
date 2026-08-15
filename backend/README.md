# backend

FastAPI service plus the two notification Lambdas. Deployed by [`infra/`](../infra/).

```
app/                the API
├── main.py         FastAPI app + Mangum handler
├── config.py       environment-driven settings
├── lifecycle.py    the order status state machine
├── repository.py   DynamoDB, with an in-memory fallback
├── fixtures.py     read-only access to the JSON tables
├── routers/        HTTP endpoints
└── services/       order logic and the SQS publisher

lambdas/
├── push/           SQS-triggered Web Push sender (Python)
└── sse/            Function URL streamer (TypeScript — see below)

scripts/            build, seed, VAPID generation
tests/              pytest
```

## Running locally

```bash
task backend:install
task backend:dev        # http://localhost:8000, docs at /docs
```

With no environment configured the API serves the JSON fixtures from `frontend/src/data/` and keeps
writes in memory. No AWS account, no credentials, no DynamoDB. Writes vanish on restart, which is
fine for local work.

`GET /health` reports which mode it is in:

```json
{ "status": "ok", "storage": "memory", "pushEnabled": false }
```

## Endpoints

| Method | Path | |
|---|---|---|
| `GET` | `/orders` | filter by `hospiceId`, `patientId`, `status` |
| `GET` | `/orders/{id}` | order plus its event timeline |
| `POST` | `/orders` | create |
| `PATCH` | `/orders/{id}/status` | **drives both notification channels** |
| `GET` | `/patients` | filter by `hospiceId`, `caseManagerId` |
| `GET` | `/products` | vendor offers — per-vendor pricing |
| `GET` | `/equipment` | the HCPCS catalog |
| `GET` | `/vendors` | |
| `GET`/`POST`/`DELETE` | `/push/public-key`, `/push/subscribe` | browser subscriptions |
| `GET` | `/health` | |

### The one endpoint that matters

`PATCH /orders/{id}/status` does four things in one request:

1. Validates the transition
2. Writes the new status
3. Appends an event row — **this feeds SSE**
4. Enqueues one SQS message — **this feeds Web Push**

It never calls a push service itself. That is the whole point of the queue: a slow or failing FCM
cannot make an order update slow or fail.

Invalid transitions return `409` with what *is* possible:

```json
{ "detail": { "message": "...", "currentStatus": "ordered", "allowedNext": ["dispatched"] } }
```

## Status lifecycle

```
delivery:  ordered → dispatched → in_transit → delivered
pickup:    pickup_triggered → picked_up
```

Forward only, no skipping, no crossing between tracks. `delivered` and `picked_up` are terminal.
Mirrors `OrderStatus` in `frontend/src/types/domain.ts`.

## Data

Read-only tables (patients, vendors, offers, catalog) are served straight from the JSON fixtures and
ship inside the Lambda bundle. Only `orders`, `order_events`, and `push_subscriptions` are in
DynamoDB, because only those are written.

`scripts/build.sh` copies `frontend/src/data/*.json` into `backend/data/` at build time —
`backend/data/` is gitignored so there is only ever one copy under version control.

## Why the SSE Lambda is TypeScript

Lambda response streaming is only implemented for the Node runtime. Python cannot hold an SSE
connection on Lambda at all. Everything else here is Python.

## Tests

```bash
task test:backend
```

Covers the transition rules including every rejected edge, that a status change enqueues exactly one
message, that a failed enqueue does not fail the order update, and that a dead push subscription is
deleted rather than retried forever.

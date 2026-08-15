# backend

The BestRx API: catalog, orders, and the live order-status stream. A FastAPI container — locally
under docker-compose, on Render in production.

Push notifications are a separate service: [../notification-service/](../notification-service/).

```
Dockerfile          dev and prod stages; built from the repo root (see below)
app/
├── main.py         the FastAPI app
├── config.py       environment-driven settings
├── lifecycle.py    the order status state machine
├── store.py        orders, events, and the SSE fan-out
├── subscriptions.py push subscriptions (the one thing in DynamoDB)
├── fixtures.py     read-only access to the JSON tables
├── routers/        HTTP endpoints, including /stream
└── services/       order logic and the SQS publisher

scripts/
└── sync-data.sh    copy fixtures for running on the host
tests/
```

The Dockerfile builds from the **repo root**, not `./backend` — the JSON fixtures live in
`frontend/src/data/` and Docker cannot copy from outside its build context.

## Running locally

```bash
task start              # frontend :5173, API :8000, docs at :8000/docs
```

No AWS account and no credentials. Orders live in memory, seeded from the fixtures at startup, and
SSE fans out in-process.

```bash
task backend:logs       # tail just the API
task backend:shell      # a shell inside the container
task test:backend       # pytest inside the container
```

Editing anything under `backend/app/` reloads the running server through the bind mount.

## Endpoints

| Method | Path | |
|---|---|---|
| `GET` | `/orders` | filter by `hospiceId`, `patientId`, `status` |
| `GET` | `/orders/{id}` | order plus its event timeline |
| `POST` | `/orders` | create |
| `PATCH` | `/orders/{id}/status` | **drives both notification channels** |
| `GET` | `/stream` | **SSE** — live order status |
| `GET` | `/patients` | filter by `hospiceId`, `caseManagerId` |
| `GET` | `/products` | vendor offers — per-vendor pricing |
| `GET` | `/equipment` | the HCPCS catalog |
| `GET` | `/vendors` | the simulated storefront vendors |
| `GET` | `/real-vendors` | real scraped DME suppliers; filter by `state`, `scope`, `hcpcs`, `hospiceFocused` |
| `GET` | `/real-vendors/{id}` | one supplier, with its source URL |
| `GET`/`POST`/`DELETE` | `/push/public-key`, `/push/subscribe` | browser subscriptions |
| `GET` | `/health` | also reports connected stream clients |

### The one endpoint that matters

`PATCH /orders/{id}/status` does four things in one request:

1. Validates the transition
2. Writes the new status
3. Appends an event — **fanned out immediately to every connected SSE client**
4. Enqueues one SQS message — **the notification service takes it from there**

It never calls a push service itself. That is the point of the queue: a slow or failing FCM cannot
make an order update slow or fail.

Invalid transitions return `409` with what *is* possible:

```json
{ "detail": { "message": "...", "currentStatus": "ordered", "allowedNext": ["dispatched"] } }
```

## SSE

`GET /stream` holds a connection open and pushes events as they happen. No polling: a status change
hands the event straight to each subscriber's queue, so latency is the network rather than an
interval.

- **`Last-Event-ID`** is honoured, so a browser reconnect resumes without a gap. `?since=N` is the
  manual equivalent.
- **`?hospiceId=`** filters, so a nurse is not woken by another network's orders.
- **A comment frame every 15s** keeps proxies from dropping an idle connection.
- **A slow client is dropped, not waited on.** Its queue is bounded; a client that falls too far
  behind resyncs on reconnect rather than stalling the write path.

## Status lifecycle

```
delivery:  ordered → dispatched → in_transit → delivered
pickup:    pickup_triggered → picked_up
```

Forward only, no skipping, no crossing tracks. `delivered` and `picked_up` are terminal. Mirrors
`OrderStatus` in `frontend/src/types/domain.ts`.

## Where state lives

**Orders and events: in this process's memory**, seeded from the JSON fixtures at startup. A
long-running container can hold them, so it does — no database to provision, no seeding step, and a
restart returns the dataset to a known-good state.

The cost, stated plainly: **writes do not survive a restart.** Fine for a demo; not a production
design. On Render's free tier a restart happens automatically after 15 idle minutes, not only on
deploy.

**Push subscriptions: DynamoDB.** The one piece of state that crosses a process boundary — this
container writes them, the push Lambda in AWS reads them. In memory they would be lost on every
restart, silently unsubscribing every nurse.

## Scaling

One uvicorn worker on purpose. SSE subscribers live in this process's memory, so a second worker
would serve clients that never receive events written by the first.

A single process handles thousands of mostly-idle SSE connections comfortably. Going beyond one
instance needs a shared broker (Redis pub/sub) so every instance sees every event — a real change,
not a config flag.

## Tests

```bash
task test:backend
```

Covers the transition rules including every rejected edge, that a status change reaches a connected
SSE client, that a stale cursor does not silence the stream, that a slow client is dropped rather
than blocking the write path, that hospice filtering works, and that a failed SQS enqueue does not
fail the order update.

## Deploying

Render builds from `render.yaml` at the repo root and redeploys on push. Its environment comes from
Terraform:

```bash
task infra:render-env    # prints the values, including a secret — do not commit
```

**Free-tier behaviour worth knowing:** the service spins down after 15 minutes of inactivity and
takes 30-60s to wake. Because orders are in memory, a spin-down also resets them to the seeded
fixtures. Hit `/health` shortly before a demo.

See [../infra/README.md](../infra/README.md).

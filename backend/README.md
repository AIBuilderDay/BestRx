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
├── carts.py        one open cart per user, in memory
├── subscriptions.py push subscriptions (the one thing in DynamoDB)
├── fixtures.py     read-only access to the JSON tables
├── mcp_server.py   every endpoint mirrored as MCP tools, mounted at /mcp
├── routers/        HTTP endpoints, including /stream
└── services/       order logic, the SQS publisher, and the auto-advance demo driver

scripts/
└── sync-data.sh    copy fixtures for running on the host
tests/
```

The Dockerfile builds from the **repo root**, not `./backend` — the JSON fixtures live in
`frontend/src/data/` and Docker cannot copy from outside its build context.

## Running locally

```bash
task start              # frontend :5173, API :8000, docs at :8000/docs
task backend:start      # just the API, no frontend container
```

No AWS account and no credentials. Orders live in memory, seeded from the fixtures at startup, and
SSE fans out in-process.

```bash
task backend:logs       # tail just the API
task backend:shell      # a shell inside the container
task test:backend       # pytest inside the container
task backend:stop       # stop just the API
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
| `GET` | `/carts/{userId}` | the user's cart, priced from the catalog; opens an empty one on first read |
| `POST` | `/carts` | create (replaces any existing cart for that user) |
| `PUT` | `/carts/{userId}` | replace the cart's lines |
| `DELETE` | `/carts/{userId}` | empty the cart |
| `POST` | `/carts/{userId}/checkout` | **cart → orders**, one per patient and vendor |
| `GET` | `/patients` | filter by `hospiceId`, `caseManagerId` |
| `GET` | `/products` | vendor offers — per-vendor pricing |
| `GET` | `/equipment` | the HCPCS catalog |
| `GET` | `/vendors` | the simulated storefront vendors |
| `GET` | `/real-vendors` | real scraped DME suppliers; filter by `state`, `scope`, `hcpcs`, `hospiceFocused` |
| `GET` | `/real-vendors/{id}` | one supplier, with its source URL |
| `GET`/`POST`/`DELETE` | `/push/public-key`, `/push/subscribe` | browser subscriptions |
| `GET` | `/health` | also reports connected stream clients |
| `POST` | `/mcp/` | **MCP** — every endpoint above, as tools (see below) |

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

### Orders advance themselves

Nobody is standing behind a real vendor's dispatch system during a demo, so `services/autoadvance.py`
ticks every `AUTO_ADVANCE_SECONDS` (default `5`, `0` disables) and moves each in-flight order one
step along its track: `ordered → dispatched → in_transit → delivered`. An order placed at the
storefront therefore reaches `delivered` about fifteen seconds later, firing SSE and a push at each
step.

It calls the same `change_status` a `PATCH` does, so an automatic move is indistinguishable from a
manual one — same validation, same event, same fan-out, same enqueue. The event records
`actorId: "system:auto-advance"`, so a timeline reader can still tell the two apart.

**Only orders created since the process started move.** The seeded fixtures are the baseline the
board is read against, and draining them to `delivered` on a timer would rewrite the dataset the
demo is explaining. Note that `canonical` does not express this — only six of the 66 seeded orders
are canonical — so the store tracks the ids it minted (`is_session_order`). The test suite sets
`AUTO_ADVANCE_SECONDS=0`.

## Carts

One open cart per user, server-authoritative. The client sends the lines it wants and renders what
comes back — **prices are never accepted from the client**, they are resolved from `vendor_offers`
on every read, so a cart can never quote a number the catalog disputes.

Updates are a whole-cart replace rather than per-line patches: the client already holds the full
list, and one shape of update means there is no ordering question between concurrent edits.
Duplicate `(offer, patient)` pairs are merged server-side so totals cannot double-count.

**Checkout groups lines by `(patient, vendor)`.** An order carries one `patientId`, and a real DME
dispatch goes to one vendor, so a cart spanning three patients across two vendors becomes up to six
orders rather than one unshippable blob. Each one is created through the same service call a single
order uses, so every cart order fans out over SSE and enqueues a push exactly as it would otherwise
— there is no second, quieter way for an order to come into existence.

Carts live in memory like orders, with the same trade. A cart is short-lived by nature (filled and
checked out in one session), so losing it on a restart costs far less than losing orders would.

## MCP

`/mcp/` serves the whole API as [MCP](https://modelcontextprotocol.io) tools, so the frontend's
AI-assisted search bar can query the catalog and act on it. Built with FastMCP and **mounted into
this same FastAPI app** — one process, one port, one deploy. A tool call and an HTTP request hit the
same `OrderStore` and the same carts, so an order created through a tool fans out over SSE and
enqueues a push exactly as one created over HTTP does. There is no second way for an order to come
into existence.

28 tools, one per endpoint: `list_products`, `list_orders`, `get_order`, `create_order`,
`update_order_status`, `get_cart`, `checkout_cart`, and the rest. Point any MCP client at
`http://localhost:8000/mcp/`.

**Written by hand, not generated.** `FastMCP.from_fastapi()` derives tools from the OpenAPI schema,
and most routers here return a bare `list[dict]` — a generated tool would tell a model nothing about
what a row contains. Each tool instead carries a docstring the model can route on, and delegates to
the same `services`/`fixtures` call its HTTP twin uses, so there is no second copy of the logic to
drift.

Three things worth knowing if you touch this:

- **The lifespan is composed, not replaced.** Mounting an ASGI app does not run its lifespan, and
  FastMCP starts its session manager there. `main.py` wraps ours around theirs; without it every
  `/mcp` request fails.
- **CORS is set on the MCP app itself.** A mounted app never passes through the parent's middleware,
  and the browser has to *read* `mcp-session-id` to hold a session across calls — a cross-origin
  response hides every header not named in `expose_headers`.
- **Errors are `ToolError`, not HTTP codes.** A status code means nothing over MCP, so the message
  carries the detail. A rejected transition names the statuses that *are* reachable, which is the
  same information the REST 409 body carries in `allowedNext`.

Tools are annotated for clients that distinguish reads from writes: reads are `readOnlyHint`, and
`update_order_status`, `checkout_cart`, `create_cart`, `update_cart` and `clear_cart` are not.
Note that the full surface is mirrored, **including the write paths** — an MCP client with access to
this endpoint can change an order's status or check out a cart.

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

**Orders, events, and carts: in this process's memory**, seeded from the JSON fixtures at startup. A
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

Covers cart pricing, line merging, the checkout split by patient and vendor, and that checkout
empties the cart and opens each order's timeline. Plus the transition rules including every rejected edge, that a status change reaches a connected
SSE client, that a stale cursor does not silence the stream, that a slow client is dropped rather
than blocking the write path, that hospice filtering works, and that a failed SQS enqueue does not
fail the order update.

The MCP tests drive a real MCP client over the mounted ASGI app rather than calling the tool
functions directly, so the mount, the composed lifespan and the session handshake are all covered —
the three things most likely to break, and the ones a unit test of the functions would miss.

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

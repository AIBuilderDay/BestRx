# Data model

The "database" is a set of JSON files in [../frontend/src/data/](../frontend/src/data/). Each file
is one table: a flat array of rows with an `id` primary key and string foreign keys. It is shaped
this way on purpose — when we outgrow it, each file becomes a SQLite/Postgres table with no
redesign.

**All data is synthetic.** The six orders marked `"canonical": true` came from the bounty organizers
and are preserved verbatim — do not edit their values. Everything else was generated to make the app
usable.

## Rules

- **Import from [`data/db.ts`](../frontend/src/data/db.ts), never from a raw `.json` file.** One
  module owns loading and lookups, so swapping in a real API later touches one file.
- **Views that need live or writable data go through [`lib/api.ts`](../frontend/src/lib/api.ts).**
  It calls the deployed backend when `VITE_API_BASE_URL` is set and falls back to `db.ts` when it is
  not, so the app still works with no backend running. See
  [Where the data actually lives](#where-the-data-actually-lives).
- **Lookups return `undefined`, not a throw.** Every caller handles the missing case and renders
  something sane. A broken foreign key must never blank the screen.
- **Types live in [`types/domain.ts`](../frontend/src/types/domain.ts)** and mirror the tables
  one-to-one. Change a table, change the type, in the same commit.
- **Timestamps are ISO 8601 with a -06:00 offset** (Mountain). "Today" in this dataset is
  **2026-08-14**, which is what makes the at-risk and pickup-delayed orders read correctly.

## Tables

| File | Rows | Primary key | Points at |
|---|---|---|---|
| `equipment_catalog.json` | 10 | `hcpcs` | — |
| `hospices.json` | 3 | `id` (HSP-) | — |
| `vendors.json` | 3 | `id` (VND-) | `realVendorId` → `real_vendors.id`. Real supplier identities; telemetry simulated — see below |
| `real_vendors.json` | 11 | `id` (RVND-) | `hcpcsCarried` → `equipment_catalog.hcpcs`. Scraped reference data — see below |
| `users.json` | 13 | `id` (USR-) | `orgId` → hospice or vendor. `email` is the login identity; permissions derive from `role` in `src/lib/auth.ts`, not from this table |
| `patients.json` | 30 | `id` (PT-) | `hospiceId`, `caseManagerId` |
| `orders.json` | 66 | `id` (DME-) | `patientId`, `hospiceId`, `vendorId`, `orderedById` |
| `order_events.json` | 188 | `id` (EVT-) | `orderId`, `actorId` |
| `inventory.json` | 11 | `serial` | `vendorId`, `hcpcs`, `orderId` |
| `emr_events.json` | 5 | `id` (EMR-) | `patientId`, `hospiceId` |
| `vendor_offers.json` | 31 | `id` (OFR-) | `vendorId`, `hcpcs` |
| `product_reviews.json` | 644 | `id` (REV-) | `offerId`, `reviewerId` |
| `patient_notes.json` | 8 | `id` (PN-) | `patientId`, `authorId` |
| `budgets.json` | 7 | `id` (BUD-) | `hospiceId`, `scopeRef`, `setById` |
| `family_members.json` | 2 | `id` (FAM-) | `patientId`. A relative who signs in to a read-only family view; also the audience for delivery notifications. See below |

```
hospices ──< patients ──< orders >── vendors
                            │  │
                            │  └──< inventory (serialized units)
                            └──< order_events (the timeline)

emr_events ──> patients        inbound signals from the EMR via BetterRX eRx
users      ──> hospices|vendors  admissions nurses, case managers, field nurses, DON, admin, dispatchers
vendor_offers ──> vendors, equipment_catalog   the storefront: price, ETA, rating per vendor per item
product_reviews ──> vendor_offers, users        individual nurse star ratings per vendor SKU
patient_notes   ──> patients, users             care-team sticky notes on a patient chart
budgets    ──> hospices, patients   caps per role and per patient purchase
```

## Two vendor tables

**`vendors.json`** is the storefront that orders point at. Each of its three rows now names a **real
Utah supplier**, scraped from that supplier's own site:

| id | Supplier | Market | Source |
|---|---|---|---|
| `VND-001` | Alpine Home Medical | Salt Lake City, UT | `alpinehomemedical.com` |
| `VND-002` | Affinity Home Medical | Salt Lake City, UT | `affinityhomemedical.com` |
| `VND-003` | IOC Home Medical | Orem, UT | `iocdme.com` |

Each row records `realVendorId` (the `real_vendors.json` row it was built from), `sourceUrl`, and
`sourceRetrieved`.

**Identity is real; operational telemetry is not.** `fleet`, `sla`, `performance30d`,
`overallRating` and `overallRatingCount` are fabricated for the demo, because no supplier publishes
truck counts, on-time percentages, POD capture rates or contracted SLA hours. Every row therefore
carries a **`simulated`** object naming exactly which fields are invented, and the `Vendor` type
documents the same. **Anything that renders one of those fields must show it as simulated** — a demo
figure must never read as a performance claim about the named company. `VND-003` carries the weak
performance profile (52% on-time pickup), which makes this disclosure load-bearing, not cosmetic.

Scraped, and therefore real: `name`, `displayName`, `market`, `hours`, `contact.dispatchPhone`.
`contact.dispatchEmail` and `contact.repName` are `null` — the suppliers do not publish them. Prices
in `vendor_offers.json` remain synthetic; see [PRICE_SOURCES.md](PRICE_SOURCES.md).

**`real_vendors.json`** is the reference table behind it: eleven real, publicly-listed DME suppliers
(six Utah, five national/multi-region), each scraped from the vendor's own site or a directory
listing, each carrying `sourceUrl` and `sourceRetrieved`. It holds **no invented fields at all** —
every value is either sourced or `null` — which is what makes it safe to widen. `RealVendor` has no
telemetry fields and must not gain any.

Rules for anyone extending this:

- An order's `vendorId` must stay a `VND-` id. Point a storefront row at a real supplier through
  `realVendorId`; do not make orders reference `RVND-` ids directly.
- Adding or repointing a storefront vendor means scraping a real source, adding the `RVND-` row
  first, and setting `sourceUrl`/`sourceRetrieved`. Never invent a supplier identity.
- Never add a field to `Vendor` that a real supplier does not publish without also listing it in
  that row's `simulated.fields`.
- `serviceAreaDescription` is prose, not `serviceAreaZips`. Suppliers publish "the Wasatch Front",
  not ZIP lists. Do not synthesize ZIPs from it. (`vendors.json` keeps a `serviceAreaZips` list for
  routing math; treat it as demo data, not a published service area.)
- `hcpcsCarried` is a mapping from each vendor's published product lines onto our catalog codes, so
  it is a coverage claim, not a price list. There are no prices — nobody publishes hospice contract
  rates. If a screen needs a price, it belongs in `vendor_offers.json`.
- If a field is `null`, the source did not state it. Render it as unknown; never backfill a guess.

The bounty's canonical orders in [bounty/SAMPLE_ORDERS.md](bounty/SAMPLE_ORDERS.md) still say
`Sample Vendor 1…3`; that is the organizers' source material and is left as written — read it as
`VND-001…003` in order.

## The tables that carry the product

**`orders`** is the spine. `status` is one of the six lifecycle stages
(`ordered → dispatched → in_transit → delivered`, plus `pickup_triggered → picked_up`). `riskState`
is orthogonal: `at_risk` for a delivery that will miss its deadline, `pickup_delayed` for a
retrieval past SLA, `null` otherwise. Delivery orders carry `targetBy`/`eta`; pickup orders carry
`pickupTriggeredAt`/`pickupDueBy`. Fields not relevant to a stage are simply absent — hence the
optional properties on the `Order` type.

**`orders[].risk`** is the explainability payload: a `score` (0-1), a one-sentence `reason` a case
manager can read aloud, a `factors` list, and an `escalation` record. Nothing in the UI should show
a score without the reason next to it.

**`order_events`** is the append-only timeline, one row per state change. Order it by `at`; it is
what a drawer or detail view renders, and it is the shape a real event feed would take.

**`vendors[].sla` vs `vendors[].performance30d`** is the promise against the reality — the pair that
makes the scorecard worth looking at. `VND-001` is the strong performer, `VND-003` is the weak one
(52% on-time pickup), and `VND-002` sits between them with a capacity problem today. **Both fields
are simulated** — see the `simulated` block on each row before rendering either.

**`emr_events`** shows the integration story concretely: a `patientStatusChange` (deceased) that
arrived 47 minutes *after* the field nurse already triggered the pickup, and one 7.5 hours late.
That gap is the argument for nurse-initiated pickup with the EMR event as a fallback.

**`vendor_offers`** is the storefront. One self-contained row per vendor SKU (one vendor, one
product — never multiple vendors on one card): `productName`, `description`, `category`,
`rentalPriceUsd`, `purchasePriceUsd`, `unit`, `deliveryEtaHours`, `deliveryLeadDays`, `inStock`, and
`imagePath`. Foreign keys `vendorId` and `hcpcs` must still resolve.

**Both prices are optional, but never both absent.** An item with `rental: true` in
`equipment_catalog` carries a monthly rate and a purchase price, because rent-versus-buy is a real
PPD lever — a short length of stay favors renting, a long one favors buying. The cheap items
(walker, commode, mask) carry only `purchasePriceUsd`. `unit` is the arrangement an offer defaults
to, not the only one it sells; the catalog's rent/buy toggle overrides it, and a cart line stores
which one was chosen. Where the numbers came from is recorded in
[PRICE_SOURCES.md](PRICE_SOURCES.md). `product_reviews.json` holds individual 1–5 star ratings plus a written `comment` from nurses,
each linked to one `offerId` (one vendor SKU). The catalog averages these per offer and shows
that item rating next to the product name. Admissions nurses and case managers see item ratings only.

**`product_reviews`** rows include `rating`, `comment`, `reviewedAt`, `reviewerId`, and `offerId`.

**`vendors[].overallRating`** and **`overallRatingCount`** are hospice-wide vendor scorecard metrics
stored for director of nursing and hospice owner views. They are not shown on the catalog storefront.
`vendorRatingSummary()` in `lib/reviews.ts` must agree with these stored values.

**`vendors[].displayName`** is the short label shown in the catalog and cart (e.g. "Alpine Home Medical").
Use it in the UI rather than trimming `name`.

**`vendors[].contracted`** marks the hospice's incumbent vendor — the baseline the cost ledger
compares every other vendor against. Exactly one vendor carries it (VND-002). It runs 81% on-time,
deliberately below the 85% service floor, because "your contracted vendor is underperforming" is the
situation the ledger exists to surface.

Every code HSP-001 orders is priced by **all three** vendors, so the ledger's price matrix has no
blank cells. When adding an offer, keep the market's shape — VND-001 highest, VND-002 mid,
VND-003 lowest, each within roughly 15% of the Medicare-allowed rate in `equipment_catalog` — and
set `unit` from `equipment_catalog.rental` (`month` for rentals, `purchase` otherwise). The cheapest
vendor is deliberately the worst performer; that tension is the point of the screen.

**`budgets`** carries both kinds from the whiteboard: a monthly cap per role, and a cap per one-time
patient purchase. `scopeRef` is a `UserRole` when `scope` is `role`, and a patient id when `scope` is
`patient_purchase`. Role caps are **derived, not guessed** — `derivedFrom.pctOfBudget` is the
fraction of `hospices[].monthlyBudgetUsd` allotted to that role, so a cap recomputes when the
hospice's total budget changes. `budgetCapUsd()` and `budgetUtilizationPct()` in `db.ts` do that
math; use them rather than reading `limitUsd` directly. `lib/budgetLedger.ts` then splits a role's
department budget evenly across its accounts (each account can override its own flat allotment,
session-only) — `patients[].caseManagerId` caseload is shown for context on that screen but no
longer drives any cap.

## Deriving PPD

PPD (per patient day) is the number the hospice buyer manages against, so cost views express spend
that way. The pieces are all in the data: `hospices[].activeCensus` for the denominator, and
`orders[].equipment` joined to the matching `vendor_offers` price for its unit for the numerator.
This is independent of role budget caps (see "Known inconsistencies" below), which are a flat
dollar allotment, not a PPD rate. See [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md) §6.

## Known inconsistencies

Real gaps in the sample data. Handle them explicitly rather than papering over them — the cost
dashboard labels each one on screen.

- **Budget caps no longer read patient counts at all.** An account's allotted budget is a flat
  dollar split of its role's department budget, independent of caseload. `assignedPatients` still
  displays on the budget screen (from `patients[].caseManagerId`) for context, but it's informational
  only — an account with zero patients still gets its role's default share.
- **PPD keeps its own denominator, separate from budget caps.** The PPD cost metric shown elsewhere
  in the app uses `hospices[].activeCensus` (142 for HSP-001) — unrelated to and unaffected by the
  budget-cap split above.
- **No `hospice_admin` budget row.** The owner has no role cap, so no department budget can be
  derived for that account. Render it as "no cap set", never as `$0`.
- **Orders span Aug 1–22, 2026 only.** There is no history for a multi-month trend. `lib/costPeriod.ts`
  exposes one period and buckets it weekly; adding history is a data change, not a code change.
- **Service areas are narrow.** VND-001 covers 4 of HSP-001's 10 patient ZIPs, VND-002 covers 1,
  VND-003 covers none. A vendor's price is not an available price if it cannot reach the patient, so
  surface `serviceAreaZips` coverage wherever vendor prices are compared. On the Potential Savings
  card (`lib/vendorSavings.ts`), coverage is grouped by patient location ("City, ST", derived from
  `patients[].address`) rather than raw ZIP, and it's a hard gate: a vendor reaching none of a
  hospice's patient locations is dropped from consideration before scoring, not just flagged. Under
  the current data this means VND-003 is never suggested to HSP-001 (Salt Lake City) — it only
  reaches Ogden — which zeroes out that hospice's genuine savings total.

## Where the data actually lives

The JSON files are still the source of truth. What changes is who reads them.

| | No backend configured | Backend deployed |
|---|---|---|
| Reference tables (patients, vendors, offers, catalog, reviews) | `db.ts` reads the JSON | the API reads the same JSON, bundled into its image |
| `orders`, `order_events` | `db.ts` reads the JSON | the API's memory, seeded from the JSON at startup |
| Writes (create order, change status) | rejected — no backend to write to | the API's memory, plus an SQS message for push |
| Push subscriptions | n/a | DynamoDB — the one table |

**Nothing about orders is persisted.** The API is a long-running container, so it holds them in
memory; a restart reloads the fixtures and discards every write. Deliberate for a demo, and stated
in [backend/README.md](../backend/README.md) rather than hidden.

Push subscriptions are the exception: the API container writes them and the push Lambda in AWS reads
them, so they need storage both processes can reach.

The Dockerfile copies `frontend/src/data/*.json` into the image at build time, and `backend/data/`
is gitignored — there is only ever one copy of a table under version control.

One field exists at runtime that is not in the JSON: each event carries a monotonic `seq`, assigned
in timeline order at startup. SSE pages forward on it, so a reconnecting browser resumes exactly
where it left off.

See [infra/README.md](../infra/README.md) for the deployment, and
[docs/superpowers/specs/2026-08-14-order-status-notifications-design.md](superpowers/specs/2026-08-14-order-status-notifications-design.md)
for why it is shaped this way.

## Adding data

Extend a table rather than inventing a new shape. If a feature needs a field that does not exist,
that is a data ticket: add the field to the JSON, add it to the type, note it here, all in one PR.
Keep new rows internally consistent — an order needs a patient that exists, a vendor that serves
that zip, and events whose timestamps agree with its status.

## Patients view

**Caseload:** the Patients list filters by `caseManagerId` matching the logged-in user. Sign in as
**Dana Whitfield** (`USR-001`, case manager) or **Bea Cordova** (`USR-010`, admissions nurse) on the
login page to see a full HSP-001 caseload with orders. This is the nurse/case-manager assignment key
until a dedicated `assignedNurseId` exists.

**`imagePath` (optional):** portrait for patient cards and the detail rail. Lives under
`frontend/public/images/patients/`. When absent, the card shows a striped fallback with the patient
id. Patients with an `imagePath` sort to the top of the caseload grid.

Portraits ship as a 400px WebP plus an `@2x` 800px variant; `imagePath` points at the 400px file and
the components build the `srcSet` from it via `portraitSrcSet()` in `lib/patients.ts`. Both are
generated from full-resolution sources in `frontend/assets/patients/` (gitignored — 40MB of PNGs) by
`pnpm images:portraits`. Re-run it after adding a portrait; commit only the generated `.webp` files.

## Family members & purchase requests (runtime stores, not frozen tables)

Family members are a new login role (`family_member`). Each links to exactly one `patientId`, signs
in to a **read-only family view** (`/family`), and can browse the catalog scoped to their own loved
one. They are the audience for the delivery notifications (SQS/messaging) still to come.

Unlike the JSON tables above, family members are **mutable at runtime** — staff add them live from
the patient chart — so they live in [`src/lib/familyMembers.ts`](../frontend/src/lib/familyMembers.ts):
seeded from `family_members.json`, with additions layered on top and persisted to localStorage
(`bestrx.familyMembers`) so a newly-added relative survives sign-out and can log in. A family login
is synthesized into a `User` (`orgType: 'family'`, `orgId` = the patient's hospice, plus `patientId`).
Sign in as **Grace Nguyen** (`grace@family.example`, seeded for `PT-88601`) to see it.

From the catalog a family member either **buys directly** (paid with a static mock card on file — see
`FAMILY_CARD` in `src/lib/family.ts`) or **requests** the item from the hospice. Requests live in
[`src/lib/purchaseRequests.ts`](../frontend/src/lib/purchaseRequests.ts) (same seed + localStorage
pattern, key `bestrx.purchaseRequests`) and surface on the patient chart for staff. Both stores expose
a `useSyncExternalStore`-friendly `subscribe`/`getSnapshot` pair.

## AI token ledger (localStorage, not a JSON table)

Every Anthropic call made by the enhanced search (`src/lib/ai/`) appends a record to
localStorage key `bestrx.ai_usage.v1`:

```ts
{ id, at, feature: 'rerank' | 'agent_order', model, inputTokens, outputTokens,
  costUsd, latencyMs, ok }
```

`summarizeUsage()` in `src/lib/ai/usage.ts` returns per-feature totals plus a grand total —
this is the data source for the cost dashboard's "AI spend" figures. Any new AI surface must
record into the same ledger with a new `feature` value (extend `AiFeature` in
`src/types/ai.ts`). Spec: [specs/enhanced-search.md](specs/enhanced-search.md).

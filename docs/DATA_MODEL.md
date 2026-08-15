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
| `vendors.json` | 3 | `id` (VND-) | — |
| `users.json` | 13 | `id` (USR-) | `orgId` → hospice or vendor. `email` is the login identity; permissions derive from `role` in `src/lib/auth.ts`, not from this table |
| `patients.json` | 30 | `id` (PT-) | `hospiceId`, `caseManagerId` |
| `orders.json` | 66 | `id` (DME-) | `patientId`, `hospiceId`, `vendorId`, `orderedById` |
| `order_events.json` | 188 | `id` (EVT-) | `orderId`, `actorId` |
| `inventory.json` | 11 | `serial` | `vendorId`, `hcpcs`, `orderId` |
| `emr_events.json` | 5 | `id` (EMR-) | `patientId`, `hospiceId` |
| `vendor_offers.json` | 16 | `id` (OFR-) | `vendorId`, `hcpcs` |
| `product_reviews.json` | 405 | `id` (REV-) | `offerId`, `reviewerId` |
| `budgets.json` | 7 | `id` (BUD-) | `hospiceId`, `scopeRef`, `setById` |

```
hospices ──< patients ──< orders >── vendors
                            │  │
                            │  └──< inventory (serialized units)
                            └──< order_events (the timeline)

emr_events ──> patients        inbound signals from the EMR via BetterRX eRx
users      ──> hospices|vendors  admissions nurses, case managers, field nurses, DON, admin, dispatchers
vendor_offers ──> vendors, equipment_catalog   the storefront: price, ETA, rating per vendor per item
product_reviews ──> vendor_offers, users        individual nurse star ratings per vendor SKU
budgets    ──> hospices, patients   caps per role and per patient purchase
```

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
makes the scorecard worth looking at. Vendor 1 is the strong performer, Vendor 3 is the weak one
(52% on-time pickup), and Vendor 2 sits between them with a capacity problem today.

**`emr_events`** shows the integration story concretely: a `patientStatusChange` (deceased) that
arrived 47 minutes *after* the field nurse already triggered the pickup, and one 7.5 hours late.
That gap is the argument for nurse-initiated pickup with the EMR event as a fallback.

**`vendor_offers`** is the storefront. One self-contained row per vendor SKU (one vendor, one
product — never multiple vendors on one card): `productName`, `description`, `category`, `priceUsd`,
`deliveryEtaHours`, `deliveryLeadDays`, `inStock`, and `imagePath`. Foreign keys `vendorId` and
`hcpcs` must still resolve. `product_reviews.json` holds individual 1–5 star ratings plus a written `comment` from nurses,
each linked to one `offerId` (one vendor SKU). The catalog averages these per offer and shows
that item rating next to the product name. Admissions nurses and case managers see item ratings only.

**`product_reviews`** rows include `rating`, `comment`, `reviewedAt`, `reviewerId`, and `offerId`.

**`vendors[].overallRating`** and **`overallRatingCount`** are hospice-wide vendor scorecard metrics
stored for director of nursing and hospice owner views. They are not shown on the catalog storefront.
`vendorRatingSummary()` in `lib/reviews.ts` must agree with these stored values.

**`vendors[].displayName`** is the short label shown in the catalog and cart (e.g. "Vendor 1").
Use it in the UI rather than trimming `name`.

**`budgets`** carries both kinds from the whiteboard: a monthly cap per role, and a cap per one-time
patient purchase. `scopeRef` is a `UserRole` when `scope` is `role`, and a patient id when `scope` is
`patient_purchase`. Role caps are **derived, not guessed** — `derivedFrom` holds the
`ppdUsd x assignedPatients x days` that produced `limitUsd`, so a cap recomputes when census moves.
`budgetCapUsd()` and `budgetUtilizationPct()` in `db.ts` do that math; use them rather than reading
`limitUsd` directly.

## Deriving PPD

PPD (per patient day) is the number the hospice buyer manages against, so cost views express spend
that way. The pieces are all in the data: `hospices[].activeCensus` for the denominator,
`orders[].equipment` joined to `vendor_offers[].priceUsd` for the numerator, and
`budgets[].derivedFrom.ppdUsd` for the allowance a cap was built from. See
[PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md) §6.

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

**`imagePath` (optional):** placeholder portrait for patient cards in the UI. Lives under
`public/images/patients/`. When absent, the card shows a striped fallback with the patient id.

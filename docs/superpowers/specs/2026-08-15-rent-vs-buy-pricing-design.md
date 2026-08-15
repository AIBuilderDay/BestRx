# Rent vs. buy pricing

**Date:** 2026-08-15
**Status:** approved, not yet implemented

## Problem

Every storefront row carries exactly one price and one unit. `vendor_offers.json` prices a
wheelchair at `$70 / month` and a hospital bed at `$1,045 / purchase`, so the choice between renting
equipment and buying it outright is baked into the dataset rather than offered to the nurse.

That is backwards for hospice DME. Rental is the common arrangement for capital equipment — Medicare
pays hospital beds, wheelchairs, oxygen equipment, CPAP, BiPAP, and air mattresses as *capped
rentals* — while cheap items (walkers, commodes, masks) are routinely purchased. Under the hospice
benefit DME is bundled into the per-diem, so the hospice pays the vendor directly; rent-versus-buy is
therefore a live PPD lever the app currently hides. A short length of stay favors renting; a long one
favors buying.

## Scope

Rental-eligible items carry both a monthly rental price and a one-time purchase price. The catalog
gets a page-level toggle that switches which price every card shows, with a per-card override for
individual items, and the cart records which arrangement was chosen per line.

Out of scope: any recommendation engine that tells a nurse which arrangement is cheaper for a given
patient. Deferred until the toggle itself is in and demoable.

## Decisions

Settled during brainstorming, recorded here so implementation does not relitigate them.

| Question | Decision |
|---|---|
| Which items get both prices? | Only those with `equipment_catalog.rental === true`. Walker, commode, and mask stay purchase-only. |
| Where do purchase prices come from? | Scraped retail bands per HCPCS; each vendor placed inside the band. Sources recorded in `docs/PRICE_SOURCES.md`. |
| Field naming | `priceUsd` → `rentalPriceUsd`; the new field is `purchasePriceUsd`. |
| Rounding | All new prices rounded up to whole dollars. |
| Toggle shape | Page-level toggle sets the mode and each card's default; per-card override for individual items. |
| Price filter and sort | Both follow the active mode. |
| Purchase-only items in Rent mode | Still listed, showing their purchase price with a "Purchase only" tag. Never hidden. |

## Data

### Prices

Purchase prices for the rental-priced offers, placed inside scraped retail bands. Vendor 1 sits at
the premium end and Vendor 3 at the value end, matching the vendor tiering already present in
`vendors.json`.

| HCPCS | Item | Band | V1 | V2 | V3 |
|---|---|---|---|---|---|
| E1130 | Standard wheelchair | $195–280 | $280 | $249 | $199 |
| E1390 | Oxygen concentrator | $485–1,000 | $999 | — | $749 |
| E0601 | CPAP device | $830–1,010 | $1,010 | — | — |
| E0470 | BiPAP | $1,550–1,800 | $1,800 | — | — |
| E0431 | Portable oxygen | $140–400 | — | $349 | — |

Rental prices for the offers that are purchase-priced today but sit on rental-eligible codes. These
are derived, not scraped: anchored on the catalog's `avgMonthlyAllowedUsd` (the Medicare-allowed
rate) and marked up to a plausible vendor rate.

| HCPCS | Item | Existing purchase | New rental / mo |
|---|---|---|---|
| E0250 | Hospital bed | $1,045 / $925 / $848 | $130 / $110 / $95 |
| E0277 | Powered air mattress | $1,395 | $175 |

A dash means that vendor has no offer row for that code. Offers on non-rental codes (E0143 walker,
E0163 commode, A7030 mask) are untouched and keep a purchase price only.

### Shape

`VendorOffer` in `types/domain.ts`:

```ts
export interface VendorOffer {
  // …unchanged fields…
  /** Monthly rental rate. Absent when the item is purchase-only. */
  rentalPriceUsd?: number;
  /** One-time purchase price. Absent when the item is rental-only. */
  purchasePriceUsd?: number;
  /** Which arrangement this offer defaults to when no mode is active. */
  unit: 'month' | 'purchase';
}
```

At least one of the two prices is always present. Both being absent is a broken row, and
`buildCatalogItems` skips it the same way it already skips an offer with an unresolvable vendor.

`unit` survives the change, demoted from "the only arrangement" to "the default arrangement".

### Provenance

Every scraped band gets a row in a new `docs/PRICE_SOURCES.md`: HCPCS code, item name, band, source
URL, and retrieval date. Derived rental rates get a row too, labeled as derived with the
`avgMonthlyAllowedUsd` figure they were anchored on.

The prices attached to Sample Vendor 1–3 are synthetic — the bands are real, the specific figures are
our placement inside them. `PRICE_SOURCES.md` says so explicitly. This mirrors how `real_vendors.json`
records `sourceUrl` and `sourceRetrieved` rather than asserting unsourced vendor facts, and it keeps
the CLAUDE.md rule against invented vendor facts intact.

`DATA_MODEL.md` links to the new doc from its `vendor_offers` description.

## Pricing mode

A new type in `lib/catalog.ts`:

```ts
export type PricingMode = 'rent' | 'buy';
```

`offerPrice(offer, mode)` resolves an offer against a mode, falling back to whichever price exists
when the requested one does not:

- Mode `rent`, `rentalPriceUsd` present → `{ amount, unit: '/mo' }`
- Mode `rent`, absent → `{ amount: purchasePriceUsd, unit: 'one-time' }` — the purchase-only case
- Mode `buy`, mirror image of the above

`CatalogProductVM` gains `availableUnits: ItemPrice['unit'][]`, so a card can tell "this item has a
choice" from "this item has one arrangement" without re-deriving it from the raw offer. A card with
one available unit renders no toggle and, when that unit disagrees with the page mode, a
"Purchase only" or "Rental only" tag.

## Catalog UI

**Page toggle.** A two-option segmented control in the catalog header, beside the sort controls:
`Rent (monthly)` / `Buy (one-time)`. Defaults to `rent`, matching what the majority of the catalog
is. It sets `PricingMode` for the page.

**Per-card override.** Cards whose offer has both prices show a small segmented control. Changing it
overrides the page mode for that card only. Switching the page toggle clears every override — one
control, one obvious meaning.

**Product detail view.** Same override control, same behavior. Shows both prices side by side, since
there is room for it there.

**Purchase-only items in Rent mode.** Listed, showing their purchase price, tagged `Purchase only`.
The tag is the honest signal; hiding an item a nurse searched for is worse than showing it with an
explanation.

**Price filter.** `priceCeiling(items, mode)` recomputes from the prices actually displayed, so the
slider's upper bound tracks the mode. A mode switch rescales `filters.maxPrice` proportionally rather
than resetting it, so a nurse who filtered to "cheap half of the catalog" stays there.

**Sort by price.** `sortCatalog` reads the mode-resolved price. No signature change beyond threading
the mode through.

## Cart

`CartLine` gains `unit: 'month' | 'purchase'`, which becomes part of line identity:

```ts
export interface CartLine {
  offerId: string;
  patientId: string;
  unit: 'month' | 'purchase';
  qty: number;
}
```

`upsertCartLine` and `setCartLineQty` key on `(offerId, patientId, unit)`. A nurse can therefore rent
one wheelchair and buy another for the same patient, and the two lines stay distinct.

`buildCartGroups` resolves each line's price through its own `unit` rather than the offer's. `CartLineVM`
already carries `priceUnit`, so the display work is mostly wiring; `CartLineRow` surfaces it as a
visible `Rental` / `One-time` label so a nurse reviewing the cart sees the arrangement without
opening anything.

`cartTotals` already splits monthly from one-time. It now splits on the line's `unit` instead of the
offer's — the same two-number summary, now reflecting a real choice.

`unitsInCartFor(lines, offerId)` keeps summing across both units. It answers "how many of this SKU
are in the cart", which is the question the card badge asks.

## Backend

- `OfferOut` in `schemas.py` mirrors the two optional price fields.
- `CartLineInput` gains `unit`, validated against the offer: rejecting a `month` line for an offer
  with no `rentalPriceUsd` is a real boundary check, not defensive noise. The client sends *which
  arrangement*, never the price — the server still resolves that from the catalog, so the cart
  cannot quote a number the catalog disputes. `_merge_lines` keys on `(offerId, patientId, unit)`.
- `checkout` writes the chosen unit onto the order's equipment entry, so the order record remembers
  what was ordered rather than re-deriving it from the offer later.
- Checkout still splits one order per `(patient, vendor)`. Unit does not split orders — a single
  order may contain both rented and purchased lines, which is how a real DME order works.
  `projectedOrderCount` in `lib/catalog.ts` stays in agreement with it.

## Sequencing

Three PRs, each independently green and revertable.

1. **Rename.** `priceUsd` → `rentalPriceUsd` across JSON, types, `lib/catalog.ts`, backend schemas and
   services, and tests. No behavior change; the diff is mechanical and reviewable in one pass.
2. **Data.** Add `purchasePriceUsd` and the derived rental rates, write `PRICE_SOURCES.md`, update
   `DATA_MODEL.md`. Still no behavior change — the fields are present and unread.
3. **Feature.** `PricingMode`, the page toggle, per-card overrides, filter and sort threading, the
   cart's `unit`, and the backend validation.

## Testing

- `lib/catalog.test.ts`: `offerPrice` under each mode including both fallback directions;
  `priceCeiling` per mode; `cartTotals` splitting on line unit; `upsertCartLine` keeping rent and buy
  lines of one offer distinct; `setCartLineQty` removing the right one of two same-offer lines.
- `data/db.test.ts`: every offer has at least one price; every offer carrying `rentalPriceUsd` sits on
  a code whose catalog entry has `rental === true`.
- `backend/tests/test_carts.py`: a `month` line against a purchase-only offer is rejected; a checkout
  mixing rented and purchased lines for one patient and vendor produces one order carrying both units.
- Manual: load the catalog, flip the page toggle, confirm prices, the filter ceiling, and the sort
  order all move together; confirm the walker keeps its `Purchase only` tag in Rent mode; add one
  rented and one purchased wheelchair for a patient and confirm the cart shows two lines and a
  correct two-number total.

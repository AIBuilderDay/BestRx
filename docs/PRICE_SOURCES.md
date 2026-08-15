# Price sources

Where the numbers in [`vendor_offers.json`](../frontend/src/data/vendor_offers.json) come from.

**The prices are synthetic; the bands are real.** The three storefront vendors now name real Utah
suppliers, but no price here
is a real quote from a real supplier — publishing one would be inventing vendor facts, which
[CLAUDE.md](../CLAUDE.md) forbids. What is sourced is the *range*: each purchase price was scraped
from retail DME listings for that HCPCS code, and each vendor's figure was then placed inside that
range. `VND-001` sits at the premium end, `VND-003` at the value end, matching the vendor tiering in
`vendors.json`.

All figures are whole dollars.

## Scraped purchase bands

Retrieved **2026-08-15**.

| HCPCS | Item | Band (USD) | Source |
|---|---|---|---|
| E0250 | Hospital bed | 500–1,150 | [Vitality Medical](https://www.vitalitymedical.com/semi-electric-hospital-bed.html) |
| E1130 | Standard wheelchair | 195–280 | [DME Supply USA](https://dmesupplyusa.com/mobility/wheelchairs/standard-wheelchairs.html) |
| E1390 | Oxygen concentrator (5L) | 485–1,000 | [Vitality Medical](https://www.vitalitymedical.com/home-oxygen-concentrators.html) |
| E0601 | CPAP device | 830–1,010 | [cpap.com](https://www.cpap.com/collections/cpap-machines) |
| E0470 | BiPAP | 1,550–1,800 | [cpap.com](https://www.cpap.com/collections/bipap-machines) |
| E0431 | Portable gaseous oxygen system | 140–400 | [Vitality Medical](https://www.vitalitymedical.com/cylinders-regulators.html) |

Bands exclude outliers that are not the item a hospice orders: bariatric beds, 10L concentrators,
and machine-plus-mask bundles were left out of the ranges above.

E0431 is the *rental* code; its purchase twin is E0430. The band covers a complete portable system
(cylinder, regulator, cart), not a bare regulator.

## Derived rental rates

Three hospital-bed offers and the powered air mattress were priced as purchases only, but sit on
codes the catalog marks `rental: true`. Their monthly rates are **derived, not scraped**: anchored
on `equipment_catalog.avgMonthlyAllowedUsd` — the Medicare-allowed monthly rate — and marked up to a
plausible vendor rate.

| HCPCS | Item | Medicare allowed / mo | Vendor rates / mo |
|---|---|---|---|
| E0250 | Hospital bed | 65.47 | 130 / 110 / 95 |
| E0277 | Powered air mattress | — | 175 |

## Which offers sell which arrangement

Only codes with `equipment_catalog.rental === true` carry both prices. The rest — walker (E0143),
commode (E0163), CPAP mask (A7030) — are purchase-only, which is how Medicare's "inexpensive or
routinely purchased" class works in practice. The catalog tags them rather than hiding them when the
storefront is showing rental prices.

## Re-scraping

Retail prices move. If these are refreshed, update the band, the retrieval date, and any vendor
figure that now falls outside its band, in one commit. A price inside a stale band is worse than a
price with an honest date on it.

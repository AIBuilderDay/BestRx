# BestRx — Project Description

**The master document.** Everything else in this repo — specs, tickets, mockups, code — descends
from this file. Read it before writing a spec, before opening a ticket, and before writing code that
changes what a screen means.

This is a **description, not a spec.** It says what we are building and why it matters. It does not
enumerate acceptance criteria, component names, or API contracts — those live in [specs/](specs/)
and [tickets/](tickets/).

Built for the **BetterRX Builder Day bounty, August 2026** ($10,000 award, judged by three BetterRX
staff). Source material: [bounty/BOUNTY_BRIEF.md](bounty/BOUNTY_BRIEF.md), the organizer FAQ in
[bounty/BOUNTY_FAQ.md](bounty/BOUNTY_FAQ.md), the live Q&A in
[bounty/BRIEFING_NOTES.md](bounty/BRIEFING_NOTES.md), and our own planning session in
[whiteboards/](whiteboards/). Where they disagree, the most recent wins: briefing notes, then FAQ,
then brief.

---

## 1. The one-line pitch

**Amazon for DME vendors, for hospices.**

A hospice orders durable medical equipment the way you order anything else in 2026: browse, compare
on price, quality, and delivery date, add to cart, assign it to a patient, and watch it arrive. Not
by fax.

## 2. The problem in one paragraph

A hospice patient is going home tomorrow afternoon and needs a hospital bed and an oxygen
concentrator in the house before they get there. A different patient died at 6am and their equipment
is still in the living room where the family has to look at it. Neither moment is controlled by the
hospice — a durable medical equipment (DME) vendor owns both — but the hospice gets blamed for both.
The ordering happens by phone, fax, or a vendor-specific portal; the case manager has no reliable way
to know whether the bed is actually coming, no way to compare what two vendors would charge or how
fast each one delivers, and no way to know an order will be late until it already is. BestRx turns
that into a storefront with shared, real-time delivery status behind it.

## 3. Who we are building for

Roles matter here — **permissions determine what you see**, and each role has a different job:

| Role | What they do in BestRx |
| --- | --- |
| **Admissions nurse** | Orders DME when a patient comes on service — the item is already prescribed, they are getting the bed or oxygen in place. The Amazon-shopper role. **Desktop, in the office.** |
| **Case manager / field nurse** | Visits regularly and orders when the patient's condition progresses. Watches status, adds notes, triggers pickup. **Phone browser, in the home.** |
| **Director of nursing** | Oversees the nurses, approves high-cost items, reads reporting, balances care against cost. Desktop. |
| **CEO / administrator** | Cost dashboards, trends, utilization. In their words: if costs cannot be managed, the solution does not survive no matter how much it helps patients. Desktop. |

Details and quotes: [bounty/BRIEFING_NOTES.md](bounty/BRIEFING_NOTES.md).

**The DME vendor** is deliberately low-friction. Baseline assumption: a vendor who **never logs into
anything** and responds to a text or an email link. A vendor portal is a stretch goal, not a
requirement — the organizers explicitly said "no vendor UI" is a legitimate answer if we can defend
it.

**The family** is not a user but is present in every decision. Timeliness and tone around a death is
the whole point of the pickup half of this product.

## 4. What BestRx is

**A storefront for hospice DME ordering, with shared delivery visibility and budget control behind
it.** Four things, in priority order:

1. **A shopping experience for equipment.** Browse and filter a catalog the way Amazon, Zara, ASOS,
   or any modern shop app works: a filtering sidebar, sort by delivery date, price, and vendor
   quality rating, product pages, cart, checkout. Select a product, then select the patient it is
   for. Ordering happens **in our platform** — nurses order directly, often under a physician's
   standing order, so it is not enough to receive orders flowing out of the EMR.
2. **Vendor matching that happens automatically.** Today a hospice is locked to one primary vendor,
   maybe a secondary if they are lucky — which is exactly where the delays come from. We match on
   proximity, supply, price, and quality rating (rated by the nurses who received the last
   delivery), and surface preferred vendors per hospice. Vendors set their own prices, so real
   comparison is possible.
3. **One pane of glass over the order lifecycle.** Every order, every stage, both sides of the
   handoff, one screen — including the risk flag that fires *before* an order is late, with a
   legible reason.
4. **Money the hospice can actually see and control.** A cost ledger that re-prices the exact basket
   you bought against every vendor in your market, budgets derived from the patients an account
   actually carries rather than a number someone guessed, spending charts filtered by time, and
   subscriptions for consumables that auto-reorder on cadence.

### What BestRx is not

- Not a DME vendor. We do not own equipment, trucks, or drivers.
- Not a replacement EMR. We sit alongside HCHB / Axxess / WellSky / MatrixCare.
- Not a vendor recruitment program. Vendor participation is an assumed condition for this build
  (organizers put network-building out of scope).
- Not a billing system. We trigger and evidence a claim; we do not adjudicate it.

## 5. The core insight we are betting on

BetterRX's research points at **delivery visibility, not DME ownership**, as the higher-leverage
problem. We agree and push two steps further:

> **Ordering and visibility are the same product.** The reason nobody has shared visibility is that
> nobody has a shared *order*. Put the order in one place — a storefront both sides touch — and
> status, ETA, risk, proof of delivery, spend, and reorder all become properties of that record
> rather than four phone calls.

And on top of that:

> Visibility alone is a dashboard. **Visibility plus a timely, explained warning** is the product.
> The unit of value is not "you can see the order" — it is "you found out at 2:05 PM that the 4:30
> discharge was going to miss, while you could still act."

A screen that shows status but does not change what the user does next is not pulling its weight.

## 6. The question the buyer will actually ask

BetterRX told us directly what the hospice buyer wants answered:

> **"How are you going to decrease my DME PPD?"**

**PPD (per patient day)** is the average DME or medication cost to care for one hospice patient for
one day. It is the metric hospice finance actually manages against — small PPD increases multiply
across hundreds or thousands of patients, and hospices work to hold PPD inside a target range without
starving patients of the equipment that keeps them comfortable. See
[bounty/BOUNTY_FAQ.md](bounty/BOUNTY_FAQ.md) §11.

**PPD is our headline number.** Cost views express spend as dollars per patient per day, not just as
a monthly total, because that is the number already on the buyer's dashboard.

Our answer, in five parts — each one maps to something we are building, not a slogan:

| Lever | How it lowers PPD |
| --- | --- |
| **Price transparency** | Today a hospice cannot see what another vendor charges for the same HCPCS code. The cost ledger re-prices the exact basket they bought against every vendor in their market, so the gap between what they pay and the best qualified price becomes a number instead of a suspicion. |
| **Qualified savings, not just cheap** | The cheapest vendor is often the one running 67% on-time. We only count savings from vendors clearing a service floor, so PPD drops without buying back the service failures that cost more than they save. |
| **Fewer avoidable rental days** | The hospice pays for every day equipment sits in the home after a death, and the target is pickup **within 24 hours**. Nurse-triggered pickup that starts in minutes instead of days removes those days directly from PPD. |
| **Fewer emergency substitutions** | A missed delivery becomes a rush order, a duplicate, or a same-day premium. Flagging an at-risk order while it can still be fixed avoids the expensive recovery. |
| **Budget caps derived from census** | `PPD allowance x assigned patients x days` makes PPD the unit of control, not just the unit of reporting — an account's ceiling moves with the patients it carries, and overspend is visible while the month is still live. |

**Every feature should be able to finish this sentence: "this lowers DME PPD by ___, or defends
quality at the same PPD by ___."** If it cannot, it is not a selling feature and it goes below the
line.

## 7. The order lifecycle

Six stages, from the brief. The whole app is organized around them.

| # | Stage | What it means | Who moves it |
| --- | --- | --- | --- |
| 1 | **Ordered** | Checkout completed. Patient, equipment, urgency, target date are set. | Admissions nurse |
| 2 | **Dispatched** | Vendor assigns it to a route; an ETA exists. | Vendor, or inferred from a vendor reply |
| 3 | **In transit / At risk** | Live status. Risk fires when the ETA will not beat the deadline. | System + vendor |
| 4 | **Delivered** | Proof of delivery captured. Hospice notified. Billing trigger fires. Nurse can rate the delivery. | Vendor driver |
| 5 | **Pickup triggered** | Patient status change (death or discharge) flags equipment for retrieval. | Field nurse (primary), EMR event (fallback) |
| 6 | **Pickup delayed** | Retrieval has not happened inside the expected window. Escalation opens. | System |

Two risk states cut across the stages: **at_risk** (a delivery will miss its deadline) and
**pickup_delayed** (a retrieval has blown its SLA).

## 8. Scope: P0, P1, P2

Straight from [whiteboards/whiteboard-1-scope.png](whiteboards/whiteboard-1-scope.png). **P0 is the
demo.** Do not start a P1 until the P0 path clicks end to end.

### P0 — must exist for the pitch

- **Login and permissions.** Role determines which views you get. Fake auth is fine.
- **Storefront:** filtering sidebar, sort by delivery date / price / vendor quality, product view,
  select product → select patient, cart and checkout.
- **Hospice dashboard**, per role: order and delivery status, notes on a patient, nurse-to-patient
  assignment, preferred vendors, the cost ledger with spend-over-time, and budget configuration.
- **Automatic vendor connection:** synthetic matching on proximity of the hospice to every vendor,
  plus supply, price, and rating.
- **Notification service** driving order status, and the pickup trigger from the field.

### P1 — if P0 is genuinely done

- **A simple backend** that serves the same data from SQLite and can export its schema — the JSON
  tables are already shaped for this.
- **Admin integrations page** for connecting an EMR provider to a hospice.

### P2 — pitch it, do not build it

- MCP server exposing the order and patient surface to other agents.
- Smart watch / iOS / Android notifications for drivers, family, nurses, and case managers.
- SMS and push notifications.
- AI product matching from a patient profile.

## 9. The three scenarios we demo

Every feature should earn its place in one of these.

### Scenario A — Ordering, and discharge readiness
An admissions nurse needs a bed and oxygen for a patient going home at 4:30 PM. In BestRx she
filters to same-day delivery, compares two vendors on price and nurse rating, adds both items to the
cart, assigns them to the patient, and checks out — one flow, no phone calls. Later, one order's ETA
slips to 5:10 PM. It flags at risk with the reason spelled out ("ETA 5:10 PM vs a 4:30 PM discharge;
this vendor's on-time rate on STAT orders is 81% and its capacity is 91% today") and three actions
attached: escalate, shift the discharge window, or request a backup vendor.

### Scenario B — Post-death pickup
Target: equipment gone **within 24 hours**, and every extra day is a day the hospice pays for.
A patient dies at 7:05 AM. The visiting nurse taps one button before leaving the home. The pickup
request reaches the vendor immediately by text with a magic link — no portal login, no phone tag —
and the family gets a scheduled 30-minute window instead of an open-ended wait. The EMR's own status
change arrives 47 minutes later and confirms rather than initiates. Contrast with the delayed case:
four days elapsed, 72-hour SLA breached, two family complaint calls, bed still in the living room.

### Scenario C — The cost ledger
The hospice owner opens the cost ledger and flips on competing vendor pricing. Every HCPCS code they
bought last quarter is re-priced against every vendor in their market, using their real volumes. The
savings number that lands is **qualified**: it only counts vendors clearing a service floor (on-time
delivery at or above 85%), because the cheapest vendor on every code is also the one running 67%
on-time and 58% on pickup — taking that money would buy back exactly the failures this product
exists to prevent. That distinction, stated on screen, is the argument.

Next to it, budget configuration: each account's monthly cap is **derived**, not guessed —
`PPD allowance × assigned patients × days in period` — so caps recompute when census moves, and every
manual override is marked and logged. See [../mockups/cost-ledger.html](../mockups/cost-ledger.html).

## 10. Principles that decide arguments

- **Shop-app feel, clinical seriousness.** Borrow the interaction patterns of Amazon, Zara, ASOS,
  and Revolve — filters, sort, cards, cart. Do not borrow their tone. No confetti, no
  "Congratulations!", nothing cheerful next to a death.
- **Explainability over sophistication.** Every risk flag says why, in one sentence, in the
  vocabulary the case manager already uses. If we cannot explain a score, we do not ship it.
- **The vendor's effort budget is near zero.** Any vendor interaction must survive being answered
  from a phone, in a truck, in under ten seconds, without an account.
- **Permissions are a feature, not plumbing.** What each role sees is a product decision the judges
  will notice.
- **Honesty about synthetic data.** All data here is fabricated. Assumptions (SLA windows, on-time
  rates, prices) are labeled as assumptions rather than dressed up as measurements.
- **Forward-compatible over feature-complete.** Live vendor inventory APIs likely do not exist. The
  ordering flow should let a real-time inventory check drop in later and degrade gracefully to
  price/service-based selection today.
- **Mobile matters where the work happens.** The vendor-connecting and ordering views must work on a
  phone or tablet at the bedside. Dashboards can assume a desktop.

## 11. Where AI earns its place (and where it does not)

The bounty explicitly rewards knowing the difference.

**Rules are right for:** SLA math, deadline comparisons, budget checks, "ETA is after the discharge
time", "96 hours elapsed against a 72-hour window", proximity sorting. Deterministic, auditable,
cheap. A model would only add latency and doubt, and we will say so plainly.

**AI earns its place where the variable count defeats hand-tuning:**
- **Service-failure risk scoring** — vendor history, equipment type, geography, day and time, route
  load, and urgency interact in ways nobody wants to maintain as an if/then tree, and vendor
  performance drifts, so static rules go stale.
- **Turning unstructured vendor replies into structured status.** A vendor texts "can do it around 3
  tomorrow"; extracting a stage and an ETA from that is exactly what a model is for, and it is what
  keeps the vendor's effort near zero.
- **Product matching from a patient profile** (P2) — mapping a diagnosis and care plan to the right
  equipment set is a genuine inference problem, not a lookup table.
- **Plain-language explanation of a flag**, grounded strictly in the computed factors.

**Safety rules for anything AI touches:** the model never invents a status, capacity, ETA, price, or
patient detail — it may only restate values present in our data; low-confidence output is shown as
low-confidence, not as fact; every high-stakes action (escalation, discharge change, vendor
reassignment, checkout) requires a human to confirm. We should be able to state a rough token cost
per order.

## 12. How this plugs in (integration shape)

A credible sketch is enough for judging; no production integration required.

- **Patient data is already integrated — do not build it.** ADT messages (admit, discharge,
  transfer) already arrive, and BetterRX already holds the patient, diagnosis, and allergies. Treat
  it as done and use mock patients. Note that paperwork often lags the patient, so never assume a
  complete record when the work starts.
- **The DME vendor side is the real integration gap**, and it is where our thinking should go:
  deliveries and inventory. BetterRX does not know what a vendor sees when an order arrives or what
  software they run — they told us to make an assumption and defend it.
- **DME delivery status is the new capability.** BetterRX does not receive it today. Our events
  (dispatched, in transit, delivered, picked up, with proof of capture) are what make DME spend and
  medication spend sit side by side per patient.
- **One EMR, drawn concretely.** HCHB has an integration layer built for exactly this — automating
  DME ordering and sharing real-time patient status with outside vendors. That is our reference,
  with the Axxess-style partner connection as the fallback pattern.
- **Standards we respect:** HCPCS Level II "E" codes for equipment; ANSI X12 837 for billing,
  triggered on delivery completion — that documentation gap is behind 15–25% DME claim denial rates.
  There is no front-end ordering standard, which is precisely why this product can exist.

## 13. Differentiation, stated bluntly

| Today | BestRx |
| --- | --- |
| Order by phone, fax, or one portal per vendor | Browse, compare, and check out in one storefront |
| No way to compare vendors on price or speed | Sort by delivery date, price, and nurse-rated quality |
| Hospice sees its request; vendor sees its route; neither sees the other | One shared record, same status on both sides |
| You learn an order failed when the family calls | You learn it will fail while you can still act |
| Pickup starts when someone remembers to call | Pickup starts the moment the nurse leaves the home |
| Vendor performance is anecdote at renewal time | SLA promised vs. actual, per vendor, per order type |
| DME spend is invisible until the invoice | A ledger that re-prices your basket against the market, and caps derived from census |

## 14. Success criteria for this build

A judge must be able to click through a running app and see, without narration:

- Log in as a role and get that role's view.
- Filter and sort the catalog, compare vendors, pick a product, assign a patient, check out.
- The lifecycle board with orders in every stage, and an at-risk order flagged before its deadline
  with a legible "why" and actions attached.
- A death-to-pickup flow that starts in the field and reaches a vendor with no login.
- Spend against budget for the hospice, expressed as PPD.
- A clear answer to "how does this lower my DME PPD?" (see §6).
- An honest, stated position on where AI is used and where rules are better.

## 15. Constraints

- **Synthetic data only.** No real patient, hospice, or vendor data, ever. Our mock database lives in
  [../frontend/src/data/](../frontend/src/data/) and preserves the organizers' six canonical orders
  verbatim.
- **Frontend-first.** React + TypeScript + Vite + Tailwind, JSON files standing in for tables. A
  Python FastAPI backend is P1; the JSON tables are shaped so they can become SQLite tables without
  a redesign.
- **Deployment target if we ship it:** Cloudflare — Pages for the frontend, Workers for a backend.
- **Time-boxed.** One weekend, a five-minute pitch. Cut scope, not honesty.

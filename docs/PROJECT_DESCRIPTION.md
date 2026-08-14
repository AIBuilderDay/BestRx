# BestRx — Project Description

**The master document.** Everything else in this repo — specs, tickets, mockups, code — descends
from this file. Read it before writing a spec, before opening a ticket, and before writing code
that changes what a screen means.

This is a **description, not a spec.** It says what we are building and why it matters. It does not
enumerate acceptance criteria, component names, or API contracts — those live in
[specs/](specs/) and [tickets/](tickets/).

Built for the **BetterRX Builder Day bounty, August 2026** ($10,000 award, judged by three BetterRX
staff). Source material: [bounty/BOUNTY_BRIEF.md](bounty/BOUNTY_BRIEF.md) and
[bounty/BOUNTY_FAQ.md](bounty/BOUNTY_FAQ.md) — the FAQ overrides the brief where they disagree.

---

## 1. The problem in one paragraph

A hospice patient is going home tomorrow afternoon and needs a hospital bed and an oxygen
concentrator in the house before they get there. A different patient died at 6am and their
equipment is still in the living room where the family has to look at it. Neither of those moments
is controlled by the hospice — a durable medical equipment (DME) vendor owns both — but the hospice
gets the blame for both. The coordination happens by phone, fax, and vendor-specific portals, so the
hospice case manager has no reliable way to know whether the bed is actually coming, and no way to
know it is going to be late until it is already late. BestRx makes that invisible handoff visible,
and flags the failure before it happens.

## 2. Who we are building for

**Primary: the hospice case manager.** They coordinate admissions and discharges, field the family
phone calls, and absorb the reputational damage when equipment is late or lingers after a death.
Judging weight sits here, because this is where BetterRX's discovery research is real (seven
hospice executive interviews). If our app does not make this person's day measurably easier, nothing
else matters.

**Secondary: the DME vendor.** Deliberately low-friction. Our baseline design assumption is a vendor
who **never logs into anything** and responds to a text or an email link. A vendor portal is a
stretch goal, not a requirement, and "no vendor UI at all, with status inferred from events" is an
equally legitimate answer if we can defend it.

**Tertiary: the hospice administrator / executive.** Wants vendor scorecards, DME spend beside
medication spend, and evidence that service failures are trending down.

**Not a user, but present in every decision: the family.** Timeliness and tone around a death are
the whole point of the pickup half of this product.

## 3. What BestRx is

**BestRx is a shared, real-time view of every piece of durable medical equipment across the hospice
and its vendors, from order to pickup, with an explainable early warning when an order is going to
fail.**

Three things, in priority order:

1. **One pane of glass over the DME lifecycle.** Every order, every stage, both sides of the
   handoff, one screen. Today this view does not exist anywhere — the hospice sees its own request
   and the vendor sees its own route, and neither sees the other.
2. **Risk before failure, with a legible reason.** An order is flagged *at risk* while there is
   still time to act, and the flag always answers "why?" in plain language a case manager can repeat
   to a family or a vendor rep. A black-box score is worse than no score.
3. **A pickup that starts the moment a patient dies, not the next business day.** The nurse in the
   home triggers it from their phone; the EMR status change is a redundant fallback. This is the
   part hospices talk about most emotionally and the part software handles worst today.

### What BestRx is not

- Not a DME vendor. We do not own equipment, trucks, or drivers.
- Not a replacement EMR. We sit alongside HCHB / Axxess / WellSky / MatrixCare, not on top of them.
- Not a vendor marketplace or procurement/bidding engine. Vendor recruitment is explicitly out of
  scope for this build (per the organizers' FAQ) — assume vendors participate.
- Not a billing system. We trigger and evidence a claim; we do not adjudicate it.

## 4. The core insight we are betting on

BetterRX's own research points at **delivery visibility, not DME ownership**, as the higher-leverage
problem. We agree, and we push one step further:

> Visibility alone is a dashboard. **Visibility plus a timely, explained, actionable warning** is
> the product. The unit of value is not "you can see the order" — it is "you found out at 2:05 PM
> that the 4:30 discharge was going to miss, while you could still move the discharge, escalate to
> the vendor, or call a backup."

Everything we build should be judged against that sentence. A screen that shows status but does not
change what the case manager does next is not pulling its weight.

## 5. The order lifecycle

Six stages, straight from the brief. The whole app is organized around them.

| # | Stage | What it means | Who moves it |
|---|---|---|---|
| 1 | **Ordered** | Hospice specifies patient, equipment, urgency, target date. Triggered at admission or pre-admission. | Hospice case manager |
| 2 | **Dispatched** | Vendor assigns it to a route; an ETA exists. | Vendor (or inferred from a vendor reply) |
| 3 | **In transit / At risk** | Live status. Risk fires when the ETA will not beat the deadline. | System + vendor |
| 4 | **Delivered** | Proof of delivery captured (signature, photo, timestamp). Hospice notified. Billing trigger fires. | Vendor driver |
| 5 | **Pickup triggered** | Patient status change (death or discharge) flags the equipment for retrieval. | Nurse in the field (primary), EMR event (fallback) |
| 6 | **Pickup delayed** | Retrieval has not happened inside the expected window. Escalation opens. | System |

Two risk states cut across the stages: **at_risk** (delivery will miss its deadline) and
**pickup_delayed** (retrieval has blown its SLA).

## 6. The three scenarios we demo

Every feature should earn its place in one of these. These are the walkthroughs a judge sees.

### Scenario A — Discharge readiness
A patient is scheduled to go home at 4:30 PM. A STAT oxygen concentrator order is in transit with an
ETA of 5:10 PM. Today, the hospice finds out at 5:15 PM when the family calls. In BestRx, the order
flags at risk the moment the ETA crosses the discharge time, the case manager sees the reason ("ETA
5:10 PM vs 4:30 PM discharge; this vendor's on-time rate on STAT orders is 81% and its route
capacity is 91% today"), and has three actions in front of them: escalate to the vendor, shift the
discharge window, or request a backup vendor.

### Scenario B — Post-death pickup
A patient dies at 7:05 AM. The visiting nurse taps one button on their phone before leaving the
home. The pickup request reaches the vendor immediately by text with a magic link — no portal
login, no phone tag — and the family is given a scheduled 30-minute window rather than an open-ended
wait. The EMR's own status change arrives later and confirms rather than initiates. Contrast with
the delayed case: four days elapsed, 72-hour SLA breached, two family complaint calls logged, and
the bed is still in the living room.

### Scenario C — Service-failure prevention
Across the hospice's whole board, the risk feed ranks what is going wrong today and why, so the case
manager works a short prioritized list instead of scanning nine orders. Over time the same signal
becomes the vendor scorecard: SLA promised versus actual, per vendor, per order type — which is what
a hospice needs at contract-renewal time and what no vendor portal will ever show them.

## 7. Principles that decide arguments

- **Explainability over sophistication.** Every flag says why, in one sentence, in the vocabulary
  the case manager already uses. If we cannot explain a score, we do not ship it.
- **The vendor's effort budget is near zero.** Any vendor interaction we design must survive being
  answered from a phone, in a truck, in under ten seconds, without an account.
- **Death-adjacent moments get designed carefully.** No cheerful copy, no confetti, no
  "Congratulations!" toasts on a pickup. Plain, respectful, fast.
- **Honesty about synthetic data.** All data here is fabricated. Where we assume something (SLA
  windows, vendor on-time rates, delivery-time distributions), the assumption is stated in the UI or
  the pitch rather than dressed up as a measurement.
- **Forward-compatible over feature-complete.** Live vendor inventory APIs likely do not exist. We
  design the ordering flow so a real-time inventory check can drop in later, and degrade gracefully
  to price/service-based selection today.
- **Mobile matters where the work happens.** Bedside ordering and the nurse's pickup trigger have to
  work on a phone or tablet. The dashboard can assume a desktop.

## 8. Where AI earns its place (and where it does not)

The bounty explicitly rewards knowing the difference. Our position:

**Rules are right for:** SLA math, deadline comparisons, "ETA is after the discharge time",
"96 hours elapsed against a 72-hour window". These are deterministic, auditable, cheap, and a model
would only add latency and doubt. We will say so plainly rather than pretending otherwise.

**AI earns its place where the variable count defeats hand-tuning:**
- **Service-failure risk scoring** — vendor history, equipment type, geography, day of week, time of
  day, current route load and urgency interact in ways nobody wants to maintain as an if/then tree,
  and vendor performance drifts, so a static rule set goes stale.
- **Turning unstructured vendor replies into structured status.** A vendor texts back "can do it
  around 3 tomorrow" — extracting a stage and an ETA from free text is exactly what a model is for,
  and it is what keeps the vendor's effort near zero.
- **Plain-language explanation of a flag**, grounded strictly in the computed factors, so the case
  manager gets a sentence they can read aloud instead of a factor table.

**Safety rules for anything AI touches:** the model never invents a status, capacity, ETA, or
patient detail — it may only restate values that exist in our data; low-confidence output is shown
as low-confidence rather than as fact; and any high-stakes action (escalation, discharge change,
vendor reassignment) requires a human to confirm. We should also be able to state a rough token/cost
figure per order.

## 9. How this plugs in (integration shape)

We do not need a production integration — a credible sketch of the data shape is enough for judging.

- **BetterRX eRx is the spine.** It already receives patient admission, discharge, and death events
  from the EMR today; those are the same signals a DME workflow keys off. We treat that as existing
  infrastructure and extend the same structured-event pattern to DME.
- **DME delivery status is a new capability.** BetterRX does not receive it today. Our events
  (dispatched, in transit, delivered, picked up, with proof-of-capture) are the new thing being
  created, and they are what makes DME spend and medication spend sit side by side per patient.
- **One EMR, drawn concretely.** HCHB has a dedicated integration layer built for exactly this
  (automating DME ordering, sharing real-time patient status with outside vendors) — that is our
  reference implementation, with the Axxess-style partner connection as the fallback pattern.
- **Coding standards we respect:** equipment identified by HCPCS Level II "E" codes; billing runs
  through ANSI X12 837 triggered on delivery completion, which is the documentation gap behind
  15–25% DME claim denial rates. There is no front-end ordering standard to conform to — that
  absence is precisely why this product can exist.

## 10. Differentiation, stated bluntly

| Today | BestRx |
|---|---|
| Phone, fax, or a vendor-specific portal per vendor | One board across every vendor in the market |
| Hospice sees its request; vendor sees its route; neither sees the other | One shared record, same status on both sides |
| You learn an order failed when the family calls | You learn it will fail while you can still act |
| Pickup starts when someone remembers to call | Pickup starts the moment the nurse leaves the home |
| Vendor performance is anecdote at renewal time | SLA promised vs. actual, per vendor, per order type |
| DME spend lives in a separate world from medication spend | Both sit against the same patient |

## 11. Success criteria for this build

A judge must be able to click through a running app and see, without narration:

- The full lifecycle board with real (synthetic) orders in every stage.
- An at-risk delivery flagged before its deadline, with a legible "why" and actions attached.
- A death-to-pickup flow that starts in the field and reaches a vendor with no login.
- Enough of a vendor-side story to prove we thought about the other end of the handoff.
- A stated, honest position on where AI is used and where rules are better.

The build order that follows from that is: lifecycle board → risk drawer with explanation → pickup
trigger flow → vendor-side lightweight response → scorecard/cost views last.

## 12. Constraints

- **Synthetic data only.** No real patient, hospice, or vendor data, ever. Our mock database lives
  in [../frontend/src/data/](../frontend/src/data/) and preserves the organizers' six canonical
  orders verbatim.
- **Frontend-first.** React + TypeScript + Vite + Tailwind, JSON files standing in for tables. A
  Python FastAPI backend is a later addition if we need it; the JSON tables are shaped so they can
  become SQLite/Postgres tables without a redesign.
- **Deployment target if we ship it:** Cloudflare — Pages for the frontend, Workers for a future
  backend.
- **Time-boxed.** One weekend, a five-minute pitch. Cut scope, not honesty.

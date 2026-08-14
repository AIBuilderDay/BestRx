# BetterRX Bounty — DME Ordering and Visibility Challenge

**Builder Day Bounty · $10,000 Award · August 2026**

Close the coordination gap between hospices and durable medical equipment (DME) vendors, from admission to pickup. Use whatever solves it best. AI is welcome, not required.

---

## 1. Overview / Problem Statement

**Two moments hospices don't control, but always get blamed for:**

1. A new hospice patient needs a hospital bed and oxygen concentrator in place **before they're discharged home**.
2. A patient passes away, and the equipment needs to be **picked up in a timely, respectful way**.

Both moments are handled by a separate DME vendor, outside the hospice's EMR and outside their direct control. When they go wrong, they land on the hospice's reputation, the family's experience, and the hospice's CAHPS scores.

**What hospices report directly:**
- Equipment arriving late for a new discharge is a recurring service failure. Some hospices pad a day of buffer because they no longer trust the vendor's timeline.
- Untimely pickup after a patient's death is distressing for grieving families and reflects poorly on the hospice.
- Most ordering happens by phone, fax, or a vendor-specific portal — rarely with real-time visibility either side can rely on.

**Why BetterRX is running this bounty:**
- Their discovery research points toward **delivery visibility, not DME ownership** as the higher-leverage problem. They want outside builders to pressure-test that assumption.
- They're deliberately not prescribing the solution.
- A hackathon lets them learn fast without committing engineering roadmap to an unvalidated bet.

**What winning looks like:** The strongest submissions make a hospice case manager's or a DME dispatcher's day measurably easier. That matters more than technical polish.

---

## 2. Core Challenge (in hospices' own words)

**The task:** Build a solution that gives hospices and DME vendors **shared visibility and coordination across the ordering-to-pickup lifecycle.** All quotes below are from BetterRX's discovery interviews with hospice executives.

### When equipment is late, it's the hospice's discharge on the line
- "If we get a call after hours for a broken wheelchair, it causes a lot of issues when equipment is outdated. Dissatisfaction for patients, and staff that need to respond." — Hospice CEO
- "In ten percent of cases she will authorize the equipment to be there a day before the discharge home, as there is no guarantee from the DME company. Big service failure issue for hospice." — Hospice CEO
- "DME is the bigger headache because of the lack of options. DME is more about the logistics. Nationals only work Monday through Friday, nine to five." — Hospice CEO

### Pickup after a death matters more than it sounds
- "It's very distressing to see the equipment of a loved one still lingering in your home. The pickup process gives the hospice a bad name." — Hospice CEO
- "Someone would die and StateServ wouldn't know about it. Patients want their equipment picked up. If we don't pick it up then we have to pay for an additional day as well." — Hospice COO
- "The DME doesn't consider themselves part of our org. But it reflects on our org. We want perfection." — Hospice COO

### Fragmented visibility — what fixing it would take
- "Three levels: one, SSO. Two, single pane of glass. Three, one place to do it all. I haven't heard of anyone doing this yet." — Hospice VP of Digital Transformation & Operations
- "If I can just log in once with SSO, that's better than having two sets of credentials. I would put this in the top two criteria: quality, price, and workflow management and integration." — same VP
- "We can see real time updates on if equipment has been ordered, left the warehouse, in route." — Hospice Admin/CEO

### Equipment quality and ownership
- "We had a wheelchair with a screw sticking out of it. Or a chair with fecal matter. People in hospice don't realize that this is a separate company." — Hospice CEO
- "We like that we have a one-on-one with their rep and get direct contact resolution when it comes to issues. Gives a lot of visibility and quick response time." — Hospice Regional VP of Clinical Care Services

---

## 3. AI Approach — "AI-preferred, with a real bar"

If AI/ML is used anywhere, you must **name the rules-based/deterministic alternative** and explain specifically why AI beats that baseline. "We used AI" as the pitch scores poorly.

**Good reasons AI wins:**
- **Pattern complexity** — e.g. predicting service-failure risk from vendor history, order type, geography, and timing has too many interacting variables for hand-tuned rules.
- **Data drift** — rules engines need constant manual retuning as vendor performance shifts; a model adapts.
- **Novel inference** — surfacing correlations no one would hard-code (e.g. a vendor's on-time rate degrading for a specific order type/region).

**What won't score well:**
- An LLM call standing in for a lookup table or simple if/then.
- "We used AI" with no stated baseline.
- AI adding latency/fragility without adding accuracy or capability.

**Required defense if you use AI (scored under AI ROI):**
1. Why AI is the right tool vs. a rules engine.
2. Safety: how you avoid hallucinated statuses/capacities/patient details; how low-confidence predictions get flagged instead of stated as fact; where a human confirms before high-stakes actions.

**It's fine to say "rules-based is better here"** — correctly identifying where deterministic is right is rewarded, not penalized. They're judging problem-solving judgment, not AI usage volume.

---

## 4. Market Landscape / Context

- DME today moves through national platforms, regional vendors, and manual coordination (phone/fax/vendor portals).
- Combined DME-plus-medication is an emerging category; EMR vendors are acquiring/partnering into DME software.
- **Key assumption to build around: BetterRX has NO existing DME vendor network today.** Your solution must create real value on day one before any vendor relationship exists, with a path to recruit vendors in. **This is a cold-start problem as much as a coordination problem.**

**Market facts:**
- Vendor networks vary by pricing model: some take a spread, others charge flat per-patient-day.
- Order tracking is mostly vendor-specific portals, not a shared hospice-and-vendor view.
- Real-time delivery tracking (GPS, proof-of-delivery) exists in DME/HME operational software but is rarely surfaced back to the hospice.
- Predictive analytics is established in hospice for clinical risk (length-of-stay, mortality) but rarely applied to DME logistics — **a relatively open lane**.

---

## 5. Required Features

Design for **both sides of the handoff** plus a notification layer.

### The Order Lifecycle (6 stages)
1. **Ordered** — triggered at admission/pre-admission. Hospice specifies patient, equipment, urgency.
2. **Dispatched** — vendor assigns to a route. ETA generated.
3. **In Transit / At Risk** — live status. Risk signal fires if delivery won't beat a deadline.
4. **Delivered** — proof of delivery captured. Hospice and family notified.
5. **Pickup Triggered** — patient status change (death, discharge) automatically flags equipment for retrieval.
6. **Pickup Delayed** — retrieval hasn't happened within the expected window.

### Hospice-Side Profile
- Patient and equipment need (type, quantity, urgency, target date)
- **Discharge-readiness flag** — equipment must be confirmed before a scheduled discharge
- **Post-death pickup trigger** — ideally tied to an EMR status change, not a manual call
- Vendor choice within a market (most hospices work multiple vendors)
- Total cost-of-care visibility — DME spend alongside medication spend
- Mobile/tablet-friendly ordering at the bedside

### DME Vendor-Side Profile ⚠️ HARDEST PART / DIFFERENTIATOR
> "Getting the hospice side right is table stakes. Solving the vendor side well, especially with no existing vendor network to lean on, is the differentiator."

- Fleet and route capacity, service area, current load
- Serialized equipment inventory: in stock, out, overdue for pickup
- Delivery/pickup status with proof-of-capture (signature, photo, timestamp)
- SLA and contract terms per hospice client, tracked against actual performance
- Resupply cadence for consumables (CPAP supplies, wound care) tied to payer-approved timelines
- Billing trigger tied to delivery completion — **DME claim denial rates run 15–25%, largely from documentation gaps**
- **Vendor recruitment and onboarding** — a path to identify, invite, and activate local/regional DME vendors from a cold start

### Shared / Notification Layer
- Real-time status visible to **both sides** (Differentiator)
- **Service-failure risk scoring** — surface an at-risk order *before* it's late (Differentiator)
- Escalation path to a case manager or vendor rep when a risk threshold is crossed
- **Explainability** — "Why was this order flagged at-risk?" must have a legible answer, not a black box

---

## 6. Integration Requirements

You don't need a production integration — a clear, technically credible approach is enough.

### DME coding and claims standards
- Equipment identified by **HCPCS Level II "E" codes** (CMS coding set for DME, 500+ codes). **E0601 (CPAP) is the single most-fulfilled DME code nationally.**
- Billing runs through the standard **ANSI X12 837** claims transaction (not DME-specific).
- There is **no front-end ordering standard** (no pharmacy-style e-prescribing equivalent) — that's why real DME integration happens through each EMR's partner-connection layer.
- Your solution needs a way to connect to **BetterRX's eRx system** so DME and medication data sit side by side per patient — treat it as data-sharing between two systems, not a shared transaction standard.

### Hospice EMR reference points
- **HCHB (Homecare Homebase)** — dedicated integration layer built to automate DME ordering and share real-time patient status with outside vendors. Existing DME integrations already plug in this way — credible precedent.
- **Axxess** — partner-connection model; patient updates sync automatically to a connected DME system. Sources disagree on a public API — design for the partner-connection pattern, not an assumed open API.
- **WellSky** — most vertically integrated; acquired a DME/HME software platform in 2024. Some WellSky agencies may already have DME tooling bundled.
- **MatrixCare** — most mature multi-partner DME ecosystem, including a bi-directional ordering interface with the leading DME-vendor software platform, built into the hospice EHR.

**"Integration-ready" for judging** = show you understand the shape of the data (patient/order record, what triggers a status change) and sketch how you'd sit alongside one of these systems. **A diagram is enough.**

---

## 7. Data Guidelines

**Synthetic data only.** No proprietary or real patient data.

- **Sample DME Orders** (synthetic, AI-generated) — six example records spanning the lifecycle incl. both risk states. See `sample-orders.md` / `sample-orders.json` in this folder.
- **CMS Medicare DME, Devices & Supplies Public Use Files** — aggregate utilization/payment/equipment stats by HCPCS code, by provider. Use for realistic distributions and cost benchmarks, NOT as literal sample orders. https://data.cms.gov/provider-summary-by-type-of-service/medicare-durable-medical-equipment-devices-supplies
- **CMS Hospice Provider Utilization and Payment PUF** — aggregated hospice-level utilization, length of stay, diagnoses, demographics. https://catalog.data.gov/dataset/cms-program-statistics-medicare-hospice
- **Do not use:** real patient info, real hospice client data, anything proprietary.

---

## 8. Deliverables (what to bring to judging)

Five things. None need polish. They need to be **true, specific, and real.**

- **A. A working application** — it must RUN. A clickable Figma flow or static demo won't cut it. Backend can be simple, but a judge must click through a real interaction.
- **B. AI approach explanation (or rationale for skipping it)** — what you used, how it compares to a rules-based baseline, best estimate of token/compute cost per patient or per order, and how you kept it safe (grounded, confidence-checked, human-confirmed for high-stakes actions).
- **C. Differentiation snapshot** — short, direct comparison: what does your solution do differently from how DME ordering happens today, and why does that matter?
- **D. Integration approach sketch** — how you'd connect to BetterRX's eRx system and at least one EMR (HCHB, Axxess, WellSky, or MatrixCare), including the data shape. A diagram is enough.
- **E. 2–3 example scenarios** — walk through real situations: discharge-readiness, post-death pickup, service-failure prevention.

---

## 9. Judging Rubric & Logistics

| Criteria | Weight | What it tests |
|---|---|---|
| Differentiation from current DME approaches | **30%** | Did the team understand today's market well enough to beat it, not just match it? |
| Addresses core user problems | **25%** | Grounded in real pain points — discharge readiness, pickup timeliness, visibility. |
| Architecture and integration-readiness | **15%** | Could this plausibly plug into BetterRX's eRx system and an EMR without a rebuild? |
| AI ROI | **15%** | If AI is used, does it demonstrably beat a rules-based alternative, and is it used safely? |
| UX and intuitiveness | **15%** | Is the user experience intuitive? |

**Logistics:**
- Eligibility: open, no minimum experience
- Team size: any (1–3 recommended)
- Max teams: 8
- Briefing: 15–20 min deep dive, Aug 14, 1:00pm
- Pitch: 5 min + Q&A (~5 min buffer per team)
- Judges: 3, from BetterRX

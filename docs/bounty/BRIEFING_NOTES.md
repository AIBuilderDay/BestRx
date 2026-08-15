# Briefing notes — BetterRX live Q&A, Aug 14

Notes from the in-person briefing and Q&A with Todd, Peter (CTO), Ben Marcus (CEO), and Eric Hemming
(President). Plain English, only the parts that change what we build. Where this disagrees with the
written brief, this wins — it is more recent and came straight from them.

## Who BetterRX is, and how they think

- **Hospices are the customer.** BetterRX sells software to hospices, not to patients and not to
  vendors. On the medication side they run a marketplace: a pharmacy network delivers, BetterRX's
  software orders, adjudicates claims, and manages the meds. DME is the same model extended.
- **The industry is squeezed.** Hospice margins keep thinning and there is no relief coming from the
  government. Everything gets judged against cost.
- **Consolidation is the market pressure.** Hospices are tired of paying for three or four platforms.
  One place to order meds, e-prescribe, order DME, and get reporting is the pitch.
- **Their mission framing:** ending suffering caused by medication and DME problems. Their NPS is 90,
  measured by a third party, and they take the relationship seriously.

## The users

Four personas. Build for these, not for a generic "user".

| Persona | What they do | Device |
| --- | --- | --- |
| **Admissions nurse** | Orders DME when a patient comes on service. The item is already prescribed; they are just getting the bed or the oxygen in place. | Desktop, in the office |
| **Case manager / field nurse** | Visits the patient regularly, orders when the condition progresses (patient now needs a wheelchair). Gets the prescription in an IDT meeting where nurses and physicians meet — the physician writes it, the nurse places the order. | **Phone**, sometimes tablet, in the field |
| **Director of nursing** | Oversees the nurses. Approves high-cost items. Reads reporting. Balances care against cost. | Desktop |
| **CEO / administrator** | Cost dashboards, trends, utilization, what things cost. If costs cannot be managed, the solution does not survive no matter how much it helps patients. | Desktop |

**Everything is web-based.** Field nurses use a phone browser, not a native app. An app is
acceptable, but web is what they run today.

## The usability bar (this is a real constraint)

- **Assume every user is brand new.** Nurse turnover in hospice is high, so you never get a trained
  user base.
- **"Think of your mom's least technical friend."** That is the user. They have watched training go
  wrong because someone said "refresh your page" and users did not know what that meant.
- **Guide the decision, do not rely on the clinician making it correctly under pressure.** BetterRX
  builds guardrails into the software so the right action is the easy one. Do the same.

## How ordering actually works

- **Ordering must live in our platform.** It is not enough to receive orders flowing from the EMR.
  DME is much less regulated than controlled substances, and nurses often work from a standing order
  from a physician ("any time they have this symptom, go ahead"). So the nurse orders directly.
- **The prescription lives in the EMR**, which is the source of truth for prescriptions and patient
  information. It flows to BetterRX from there.
- **Decision factors when choosing, in their words:** is it in stock, when will it arrive, and what
  does it cost. Straight Amazon logic — same price, faster delivery wins.
- **Today hospices are locked to a primary vendor**, with a secondary if they are lucky. That lock-in
  is where the delays come from. More visibility and more selection is the differentiator.
- **Vendors set their own prices.** DME pricing is not fixed by the government or by insurance, so
  price comparison is real and worth building.
- **Hospices carry almost no inventory.** Most hospice care happens in the home; hospices are not
  facilities. A nurse may keep comfort kits and pain meds in the car, but nobody is carrying a bed.
  There is no "hand one out now and swap later" flow.

## Pickup

- **Target is within 24 hours.** The emotional case: a loved one dies and the bed sits in the home
  for three days with nobody coming for it.
- **The hospice pays for every one of those days** while the equipment sits there. Late pickup is a
  direct cost, not only a dignity problem.

## Reputation — why late or dirty equipment matters

The hospice takes the blame for the vendor, every time. Families do not know the vendor exists. Late
delivery, a dirty chair, a chair with fecal matter on it — that lands on the hospice's **CAHPS
scores** (the public survey scores families use to choose a hospice). Anything our software does to
help a hospice pick the right vendor and hold vendors accountable is valuable.

## Integration — what is already done, and what is not

- **Patient data is already integrated. Do not build it.** ADT messages (admit, discharge, transfer)
  already arrive, and BetterRX already has the patient, diagnosis, and allergies flowing in. Mock
  patients are fine, and there is no integration story to tell there.
- **The real gap is the DME vendor side** — deliveries and inventory. That is where integration
  matters and where we should spend our thinking.
- **Hospice EMRs to know:** Home Care Home Base (biggest), MatrixCare, WellSky, Axxess. Epic is the
  big hospital EMR, not the hospice one.
- **Paperwork lags reality.** A nurse gets called to do an admit before the documentation lands,
  because the patient matters more than the paperwork. Do not assume the record is complete when the
  work starts.

## The vendor side is genuinely unknown

BetterRX does not know what a vendor sees when an order arrives, or what software they use. They
assume some integration with vendor software, but do not know whether a portal is needed or whether
a magic link or similar would do.

> "I would really let you all decide that, make some assumptions, and just defend those assumptions.
> Your knowledge here is going to be about as good as ours."

So: pick an approach, state the assumption plainly, and defend it.

## Logistics

- Todd and Peter are the contacts. Questions go in Slack.
- **All answers are given publicly in Slack** so every team gets the same information. No private
  replies.
- They are reachable all day, slower at dinner, offline overnight. Ask early.

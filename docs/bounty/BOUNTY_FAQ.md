# BetterRX Bounty FAQ — Pre-Build Responses

Consolidated answers to every question submitted across all bounty team surveys, grouped by topic. (Converted from `BetterRX Bounty FAQ.docx`.)

---

## 1. DME Vendor Access & Prior Research

**Q: Is there a DME vendor/dispatcher we can talk to?**

No — not before or during the hackathon. The discovery study interviewed **seven hospice executives; no vendor-side interviews**. BetterRX has had exploratory conversations with DME-adjacent platforms (competitors/potential partners), giving real visibility into vendor economics, incentives, and positioning vs. StateServ and Dragonfly. What they *don't* have is first-hand insight into a vendor's day-to-day ops (dispatch, driver logistics, condition/QA at delivery). **Treat vendor operational reality as an assumption to state clearly, not something they can validate.**

## 2. DME Vendor Network Status

BetterRX has **no owned DME vendor relationships today**. Only exploratory conversations with adjacent platforms for competitive/partnership intelligence.

## 3. Vendor Cold-Start Philosophy & Judging Weight ⚠️ (changes the brief's emphasis)

- **Network-building (recruiting/activating vendors) is OUT OF SCOPE** for the weekend. Treat vendor participation as an assumed, given condition.
- **Baseline design target: a vendor who never logs into anything** and only responds via confirmation email or text (SMS/magic-link style). A portal is a stretch goal, not a requirement.
- **Judging weight sits primarily on the hospice-side experience** (that's where the real discovery data is). The vendor side earns *bonus* credit for either:
  - (a) a lightweight, no-login-required vendor UX, or
  - (b) a well-reasoned case for why no vendor UI is needed at all (e.g., status inferred from delivery/EMR events).
  - Both paths are legitimate; "no UI" is not scored down.

## 4. eRx Integration & Data Availability

- **Patient status events (admission, discharge, death): YES** — BetterRX's eRx integration already receives these from the EMR today. Treat as existing infrastructure; a DME workflow can reliably key off the same signals that drive medication workflows.
- **Delivery timestamp history: NO** — BetterRX does not receive/store DME delivery status (limited medication-side cases only where pharmacy integration exists). Assume DME delivery status is a **new capability to build**. The medication side already proves the structured-event-capture pattern, so extending it is a natural next step.
- **Sample eRx schema: YES** — representative JSON payloads of the actual eRx data model:

### Patient / Demographics Event (`newOrUpdatePatient`)

```json
{
  "meta": { "eventType": "newOrUpdatePatient" },
  "account": { "identifiers": [{ "id": "testAccountId" }] },
  "patient": {
    "identifiers": [{ "id": "testPatientId", "idType": "testPatientIdType" }],
    "demographics": {
      "firstName": "Donald",
      "lastName": "Tester",
      "dob": "1960-01-14",
      "gender": "M",
      "ssn": "123-35-3752",
      "medRecNo": "1234567890",
      "phone": "123-456-7890",
      "address": {
        "street1": "testStreet1",
        "street2": "testStreet2",
        "city": "testCity",
        "state": "testState",
        "zip": "testZip",
        "country": "USA"
      },
      "diagnoses": [{ "codeType": "icd10Code", "code": "C90.00", "isPrimary": true }],
      "allergies": [{ "description": "Latex" }]
    }
  }
}
```

### Medication Event (`newMedications`)

```json
{
  "meta": { "eventType": "newMedications" },
  "account": { "identifiers": [{ "id": "testAccountId" }] },
  "patient": {
    "identifiers": [{ "id": "testPatientId", "idType": "testPatientIdType" }],
    "medications": [
      {
        "externalId": "0b307548-2c46-4b40-8b16-bb5501f5d6c5",
        "product": {
          "codeType": "NDC",
          "code": "00054051741",
          "name": "MORPHINE CONCENTRATE 100 MG/5 ML (20 MG/ML) ORAL SOLUTION"
        },
        "sig": "TAKE 0.25ML BY MOUTH FOR MODERATE PAIN RATING OF 4-7/10. IF NOT RELIEVED, MAY REPEAT 0.25 ML EVERY 60 MINUTES, CALL HOSPICE IF INEFFECTIVE.",
        "physician": { "identifier": { "id": "1497771109", "idType": "npi" } }
      },
      {
        "externalId": "1e37f8c1-522e-460a-b795-7de9207438cb",
        "product": {
          "codeType": "NDC",
          "code": "00054051741",
          "name": "MORPHINE CONCENTRATE 100 MG/5 ML (20 MG/ML) ORAL SOLUTION"
        },
        "sig": "TAKE 1 ML BY MOUTH EVERY HOUR AS NEEDED FOR MODERATE PAIN NOT RELIEVED BY 0.5 ML OR FOR SEVERE PAIN RATING OF 8-10/10.",
        "physician": { "identifier": { "id": "1497771109", "idType": "npi" } }
      }
    ]
  }
}
```

## 5. Vendor Economics — Who Pays

**The hospice pays a per-patient-day (PPD) fee**, which can be bundled with the existing pharmacy-tech PPD BetterRX already charges.

## 6. Risk Scoring & Available Data

- **No proprietary/anonymized delivery-timing data will be provided** — it doesn't exist in shareable form.
- CMS DMEPOS Public Use Files (data.cms.gov) are a legitimate public baseline for **utilization and cost patterns** (by referring provider, supplier, equipment category; back to 2013) — but they reflect **billing, not logistics**: no delivery timing or fulfillment data. Timeliness/reliability scoring must rest on synthetic data or clearly stated assumptions.
- **AI ROI judging: approach and honesty about the baseline, NOT measured accuracy.** There's no held-out dataset. A well-reasoned model on CMS utilization data with clearly labeled assumptions beats manufactured precision.

## 7. Delivery Windows & SLAs

No formally defined delivery-window standard exists (no DME contracts held). Reasonable industry-practice assumptions to design against, **stated explicitly**:

- **Urgent/STAT** (hospital bed, oxygen at admission): **same-day**, i.e. same-day-of-admission standard.
- **Routine**: within **24 hours**, with a defined (even configurable) SLA.

## 8. Pickup Trigger ⚠️ (refines the brief)

**Nurse-in-the-field trigger is the preferred primary design**, not EMR status propagation alone. Discovery interviews surfaced a case where a patient's death didn't reach the DME vendor's system in time for pickup. **Support both paths: nurse-initiated as the primary, faster signal; EMR status change as a redundant fallback.**

## 9. Equipment Condition & Vendor Verification

- Condition/cleanliness is a **real, recurring pain point** (broken wheelchairs, a visibly contaminated chair) but is **not a required feature**. A thoughtful quality/condition verification design (pre-delivery attestation, post-delivery confirmation, or a lightweight photo/checklist flow) is a **strong differentiator**.
- **Live vendor inventory API: unlikely to exist.** Design the ordering flow so a real-time inventory check could be added later, with graceful fallback to a price/service-based experience. **Forward-compatible design is exactly what judging values most.**

## 10. Post-Hackathon Path

BetterRX will review winning submissions for production quality and **intends to use the work (in part or whole) as a foundation for a future DME product** — a genuine roadmap opportunity, not just an exercise.

## 11. The buyer's question: "How are you going to decrease my DME PPD?" ⚠️ (organizer guidance, added Aug 14)

Direct from BetterRX during the build: **the hospice buyer is looking for the answer to one
question — how are you going to decrease my DME PPD?** Be prepared to answer it in the pitch.

**PPD (per patient day)** is the average medication or DME cost to care for one hospice patient for
one day. It is a critical financial metric for hospices: even small increases in PPD add up to
significant cost across hundreds or thousands of patients. Hospices work to keep PPD inside a target
range while ensuring patients receive the medications and DME they need for comfort and quality of
life.

Two consequences for our build:

1. **PPD is the headline number, not a footnote.** Cost views should express spend as PPD, not only
   as a monthly total, because PPD is the number the buyer already manages against.
2. **Every feature needs a PPD story.** If a screen cannot be connected to lowering PPD or defending
   quality at the same PPD, it is not a selling feature. See
   [../PROJECT_DESCRIPTION.md](../PROJECT_DESCRIPTION.md) §6 for our answer.

# Spec: <area name>

**Owner:** <name>
**Mockup:** [../../mockups/<file>.html](../../mockups/<file>.html)
**Status:** draft | agreed | building | done

## Why this exists

Two or three sentences tying this area back to a section of
[PROJECT_DESCRIPTION.md](../PROJECT_DESCRIPTION.md). Which scenario (A, B, or C) does it serve, and
what does the case manager do differently because it exists?

## In scope

- Bullets. Concrete. Each one visible or clickable in the running app.

## Out of scope

- Bullets. Things a reasonable agent might assume are included, that are not. Be explicit here —
  this is the section that prevents scope creep.

## Screens and states

For each screen: what it shows, what it looks like empty, what it looks like while loading, what it
looks like when a lookup fails. Reference the mockup for layout instead of describing pixels.

## Data used

Which tables in [../../frontend/src/data/](../../frontend/src/data/), which fields, and any derived
values. Note anything the mock data does not currently support — that is a data ticket.
See [../DATA_MODEL.md](../DATA_MODEL.md).

## Rules and logic

Deterministic rules stated plainly (SLA math, deadline comparisons, sort order, thresholds). If any
part of this is AI rather than rules, say what the rules-based baseline would be and why AI beats it
— that is a judged criterion.

## Acceptance criteria

- [ ] Observable, checkable statements. "Clicking a flagged row opens a drawer showing the risk
      score, the reason sentence, and at least three factors" — not "risk drawer works".

## Tickets

- `TICKET-ID` — one line each, linked once created.

## Open questions

- Things a human needs to decide. Do not guess these in code.

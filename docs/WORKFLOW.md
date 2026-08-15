# How we work

Four artifacts, in order. Each one narrows the last. Nobody writes code straight from the project
description.

```
PROJECT_DESCRIPTION.md   what we're building and why        (one file, shared, rarely changes)
        ↓
mockups/<area>.html      what the screen looks like         (humans read this)
        ↓
docs/specs/<area>.md     what "done" means for that area    (agents read this)
        ↓
docs/tickets/<id>.md     one self-contained unit of work    (an agent picks this up and builds)
        ↓
a PR per ticket, opened with gh
```

**Markdown is for agents. HTML is for humans.** Specs and tickets are Markdown because that is what
a Claude session reads well. Mockups are self-contained HTML files because that is what a person can
open in a browser and react to in ten seconds.

## Who owns what

From the planning session ([whiteboards/whiteboard-2-views.png](whiteboards/whiteboard-2-views.png)).
Unassigned rows are up for grabs — put your name on one before you start, in a PR.

| Area | View | Owner |
| --- | --- | --- |
| Storefront | Sort by delivery date, vendor quality rating, price | Yirang |
| Storefront | Filtering sidebar (Amazon / shop-app style) | Yirang |
| Storefront | Select product → select patient | Yirang |
| Storefront | Payment and cart view | McKay |
| Auth | Login page, permissions determining views | McKay |
| Orders | Order and delivery status | Kalo |
| Dashboard | Spending charts (filter by time, comparison, subscriptions) | Kalo |
| Dashboard | Budget configuration | Kalo |
| Patients | Patient information view | Nathan |
| Patients | Nurse-to-patient assignment | Nathan |
| Dashboard | Notes on patient status from case manager and nurse | unassigned |
| Vendors | Preferred vendors, auto-suggested by price and reviews | unassigned |
| Pickup | Field-nurse pickup trigger and vendor notification | unassigned |

For your area you:

1. Read [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md).
2. Build an HTML mockup in [../mockups/](../mockups/) — static, self-contained, no build step, no
   external CDN. It only has to communicate the idea.
3. Write a spec in [specs/](specs/) from the description plus the mockup. Use
   [specs/TEMPLATE.md](specs/TEMPLATE.md).
4. Break the spec into tickets in [tickets/](tickets/). Use [tickets/TEMPLATE.md](tickets/TEMPLATE.md).
5. Work the tickets, one PR each.

## Rules that keep parallel work from colliding

- **One owner per area.** Two people editing the same view at once wastes more time than it saves.
- **Shared code changes get announced.** Anything in `src/lib/`, `src/types/`, `src/data/`, or
  `src/components/ui/` is shared — say so in the PR title and keep the change small.
- **Tickets are sized to one sitting.** If a ticket cannot be built and verified in one focused
  pass, split it.
- **A ticket names the files it will touch.** That is how we spot two tickets colliding before the
  merge conflict, not after.
- **Every PR runs `task test` first.** Typecheck and tests green, app loaded once, before you say
  it works.

## Naming

- Mockups: `mockups/<area>.html` — e.g. `orders-board.html`, `pickup-flow.html`.
- Specs: `docs/specs/<area>.md` — e.g. `orders-board.md`.
- Tickets: `docs/tickets/<AREA>-<n>-<slug>.md` — e.g. `ORD-1-lifecycle-table.md`.
- Branches: `feat/<area>-<slug>`, `fix/<slug>`, `docs/<slug>`.

# Components

Reusable UI, grouped by domain. A component that is only used by one view can live next to that
view instead; move it here the moment a second view needs it.

| Folder | Holds |
| --- | --- |
| `layout/` | Shell, sidebar, header, page frame |
| `catalog/` | DME catalog grid, filters, patient-assignment sheet, cart drawer |
| `orders/` | Order rows, lifecycle stepper, status pills, order detail pieces |
| `risk/` | Risk badges, score bars, the explanation drawer, escalation actions |
| `pickup/` | Pickup trigger flow, family notification window, proof-of-pickup |
| `vendor/` | Vendor scorecards, capacity, the lightweight no-login vendor response |
| `ui/` | Generic primitives with no domain knowledge: button, pill, drawer, empty state |

Rules: one job per component, under about 150 lines, props typed explicitly. Data shaping belongs in
`src/lib/`, not in JSX. Anything in `ui/` is shared — keep changes to it small and say so in the PR.

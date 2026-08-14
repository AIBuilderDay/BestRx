# Views

One file per screen. A view composes components, reads from `src/data/db.ts`, and owns the state for
that screen. No business logic here that another screen would want — that goes in `src/lib/`.

Name a view after what the user calls it: `OrdersBoard.tsx`, `PickupQueue.tsx`, `VendorScorecard.tsx`.

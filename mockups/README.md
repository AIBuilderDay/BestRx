# Mockups

Static HTML mockups. **These are for humans** — open one in a browser to react to a layout before
anyone writes React. Agents skim them for structure; the spec is the source of truth for behavior.

Rules:

- One self-contained file per area. Inline CSS and JS, no build step, no external CDN.
- Fake data is fine, but keep it consistent with `frontend/src/data/` so the mockup and the app tell
  the same story.
- A mockup is disposable. When the real view ships, the mockup stops being maintained — it is a
  conversation, not a spec.

| File | Area | Notes |
| --- | --- | --- |
| `orders-board.html` | Hospice orders board | **The starter template.** Tokens, type scale, pills, stat row, and the drawer pattern in `docs/DESIGN_SYSTEM.md` came from here. Lifecycle table, stage stepper, risk drawer with explanation and actions |
| `cost-ledger.html` | Cost of care and budgets | The spending charts from the whiteboard. Price matrix across vendors, qualified-savings logic with a service floor, sparklines, spend-over-time area chart, and budget caps derived from `PPD x patients x days`. The semantic colours (`good`, `warn`) and the chart series ramp came from here |

Known inconsistency: `cost-ledger.html` uses its own vendor names (Northstar, Cascade, Meridian,
Rotera) while the app data uses Sample Vendor 1-3, which the bounty's canonical orders reference.
The app follows `frontend/src/data/`; treat the mockup names as placeholders.

New mockups should reuse the tokens in `orders-board.html` so everything stays one product. If you
change a token there, change it in `frontend/src/index.css` and `docs/DESIGN_SYSTEM.md` too.

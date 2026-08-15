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
| `orders-board.html` | Hospice orders board | **The starter template.** Tokens, type scale, pills, stat row, and the drawer pattern in `docs/DESIGN_SYSTEM.html` came from here. Lifecycle table, stage stepper, risk drawer with explanation and actions |
| `login.html` | Sign in and roles | Three tabbed layout options (card, minimal, split) sharing one form + demo-account wiring. Four demo accounts (owner, director of nursing, case manager, admissions nurse) with per-role permissions from `docs/PROJECT_DESCRIPTION.md` §3. Accounts mirror `frontend/src/data/users.json`; password is `demo` |
| `logo.html` | The logo | **The** BestRx mark: the monochrome capsule (knockout wordmark + superscript RX, after the BetterRX lockup), at hero, nav, and favicon scale, light and inverted. Implemented as `frontend/src/components/ui/Logo.tsx` and `frontend/public/images/brand/` — use it everywhere, per `docs/DESIGN_SYSTEM.html` |
| `agent-cart-handoff.html` | AI agent → cart hand-off | **The final round** (replaces the A/B/C options file): comet from the bar to the cart icon + the gradient-ring landing, in two cuts — the straight combination and a flashier one with a streaking tail and burst. Ocean-sweep blues. Drawer auto-opens, agent-added line gets a "✦ Added by AI" chip. Pairs with `enhanced-search.html` |
| `enhanced-search.html` | AI-enhanced nav search | **The chosen design (Option C):** Search / ✦ AI switch inside the bar, blues only. Now refining the AI-mode ignition animation — three interactive wave variants (ocean sweep, orbit, liquid halo), both themes. Standing visual reference for implementation. Plan: `docs/specs/enhanced-search.md` |
| `cost-ledger.html` | Cost of care and budgets | The spending charts from the whiteboard. Price matrix across vendors, qualified-savings logic with a service floor, sparklines, spend-over-time area chart, and budget caps derived from `PPD x patients x days`. The semantic colours (`good`, `warn`) and the chart series ramp came from here |

Known inconsistency: `cost-ledger.html` uses its own vendor names (Northstar, Cascade, Meridian,
Rotera) while the app data now uses real scraped suppliers — Alpine Home Medical, Affinity Home
Medical and IOC Home Medical (VND-001…003, which the bounty's canonical orders reference as Sample
Vendor 1-3).
The app follows `frontend/src/data/`; treat the mockup names as placeholders.

`cost-ledger.html` is built at `/dashboard` (`frontend/src/views/Dashboard.tsx`), open by default to
the roles holding `reporting`. Four of its premises do not survive the real data, and the built
screen departs from it deliberately in each case — the sidebar becomes the app's top nav, the period
tabs collapse to the one month of orders on file, "savings available" becomes a signed delta because
the only vendor clearing the service floor is also the most expensive, and every vendor column
carries its ZIP coverage. See "Known inconsistencies" in [../docs/DATA_MODEL.md](../docs/DATA_MODEL.md).

New mockups should reuse the tokens in `orders-board.html` so everything stays one product. If you
change a token there, change it in `frontend/src/index.css` and `docs/DESIGN_SYSTEM.html` too.

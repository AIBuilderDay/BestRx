# Design system

**Deliberately basic, and meant to be edited.** It was lifted from our two working mockups —
[../mockups/orders-board.html](../mockups/orders-board.html) (lifecycle table, stage stepper, risk
drawer) and [../mockups/cost-ledger.html](../mockups/cost-ledger.html) (spend ledger, trend chart,
budget configuration) — and turned into tokens plus a handful of primitives so every screen looks
like the same product on day one.

It is a starting point, not a rulebook handed down from on high. **Anyone can change it as we go**,
as long as the change lands here and in [../frontend/src/index.css](../frontend/src/index.css)
rather than being worked around inside one component.

## The look, in one sentence

Near-monochrome, thin borders, generous whitespace, tabular numbers, colour used only where it
carries meaning. Shop-app interaction patterns, clinical restraint in tone.

## Tokens

Defined in [../frontend/src/index.css](../frontend/src/index.css) as CSS custom properties, exposed
to Tailwind through `@theme inline`. Light and dark both ship; dark follows the OS unless
`data-theme` is set on the root element.

### Surfaces, lines, text

| Token | Utility | Use for |
| --- | --- | --- |
| `--bg` | `bg-bg` | Page background |
| `--bg-subtle` | `bg-bg-subtle` | Table headers, footers, inset rule bars |
| `--surface` | `bg-surface` | Cards, drawers, anything raised |
| `--hover` | `bg-hover` | Row and control hover |
| `--track` | `bg-track` | Empty half of a meter or progress bar |
| `--line` | `border-line` | Default borders and dividers |
| `--line-strong` | `border-line-strong` | Secondary buttons, table footers, emphasized dividers |
| `--ink` | `text-ink` | Primary text, headings, filled bars, the main chart line |
| `--ink-2` | `text-ink-2` | Secondary text, labels |
| `--ink-3` | `text-ink-3` | Tertiary text, breadcrumbs, axis labels, timestamps |
| `--solid-bg` / `--solid-ink` | `bg-solid-bg` / `text-solid-ink` | Primary buttons, active pills, tooltips (inverts in dark) |

### The three semantic colours

Colour is meaning, never decoration. There are exactly three, each with a background tint for fills.

| Token | Utility | Means |
| --- | --- | --- |
| `--good` / `--good-bg` | `text-good`, `bg-good-bg` | Savings available, best qualified vendor, under budget, delivery completed on time |
| `--warn` / `--warn-bg` | `text-warn`, `bg-warn-bg` | Near or over budget, service risk (a cheap vendor that misses SLAs), a rate override |
| `--risk` / `--risk-bg` | `text-risk`, `bg-risk-bg` | An order that will miss its deadline, a breached pickup SLA |

`warn` is a caution about a choice; `risk` is a patient-facing failure in progress. If you cannot say
which one a case applies to, it probably needs neither — use ink levels.

**Do not add a fourth.** No blue link colour, no separate info or neutral-status palette.

### Chart series

| Token | Utility |
| --- | --- |
| `--s1` … `--s4` | `text-s1`, `bg-s2`, … |

A four-step grayscale ramp, checked for colour-vision deficiency. Categorical series use these in
order; `good` and `warn` stay reserved for their meanings above. If a chart needs more than four
series, it needs a different chart.

### Radii

`--radius-control` (7px) for buttons and inputs, `--radius-card` (10px) for cards and tables,
`--radius-panel` (12px) for drawers and modals. **Never hardcode a hex value or a pixel radius in a
component.** If the tokens do not cover it, add a token.

## Type and numbers

Base 14px / 1.5, system font stack. Page titles 22px semibold with tight tracking; card and section
titles 14–16px semibold; body 13–14px; labels, axis text, and metadata 11–12px. Uppercase with wide
tracking is reserved for table headers and small control labels.

**Any number that lines up in a column gets `tabular-nums`** — IDs, times, counts, prices, scores,
percentages. Money is right-aligned in tables, with the extended total as a smaller line beneath the
unit price where both matter.

## Primitives

In [../frontend/src/components/ui/](../frontend/src/components/ui/). Import from the barrel:
`import { Button, Card, Meter, PageHeader, Pill, Stat } from '../components/ui'`.

| Component | Variants | Notes |
| --- | --- | --- |
| `Button` | `primary`, `secondary`, `ghost` | One primary action per view |
| `Pill` | `default`, `solid`, `good`, `warn`, `risk` | Order stage, budget state, risk flag, filter chip |
| `Card` | `emphasis` | The default container. `emphasis` draws a full-ink border — for the one thing that needs attention |
| `Stat` | `tone`, `emphasis` | Label, big number, optional detail. `tone` colours the number when the number itself is the news |
| `Meter` | `neutral`, `good`, `warn`, `risk` | Proportion bar for budget utilization, risk score, on-time rate. Requires a `label` for screen readers |
| `PageHeader` | — | Breadcrumb, title, subtitle, optional right-side action |

Still to be built, and visible in the mockups if you need a reference: the sidebar shell, the
filter-tab row, the compare switch, data tables with sortable headers and a totals footer, the
lifecycle stepper, the detail drawer with its ladder rows, sparklines, and the area chart with
tooltips. **Build these in your area's folder first** (`components/orders/`, `components/vendor/`, …).
When a second area needs one, move it into `ui/` and add a row above.

## Charts

The cost ledger sets the bar. Follow it:

- **Derive everything.** No hardcoded totals on screen — every figure comes from the data
  structures, so changing a period or a filter changes the whole view coherently.
- **Round axis ticks.** Scale to a nice step (1, 1.5, 2, 2.5, 5 × a power of ten), not to
  `max × 1.1`.
- **Label the SVG.** Every chart carries a `role="img"` and an `aria-label` that states the shape and
  the endpoints. Hover targets get their own accessible labels and keyboard focus.
- **Small multiples over many charts.** Seven sparklines in a table column read faster than seven
  separate charts.
- **The shaded gap is the point.** When comparing two lines, fill the space between them — that area
  is the money, made visible.

Before building any chart, load the `dataviz` skill if it is available. It covers palette, form, and
legend rules in more depth than this file.

## Rules

- **Borders over shadows.** No drop shadows except on a true overlay.
- **Focus is global.** `:focus-visible` is styled once in `index.css`. Do not remove or re-style
  outlines per component.
- **Dark mode is not optional.** Use tokens and you get it free. A hardcoded colour breaks it, which
  is the fastest way to spot one.
- **Tables scroll inside their own wrapper**, never the page. The wrapper needs `overflow-x: auto`,
  and its grid parent needs `min-width: 0` or the whole page scrolls sideways on mobile instead.
- **Respect motion preferences.** Any transition gets a `prefers-reduced-motion` escape.
- **Tone.** Plain, specific, respectful. No exclamation marks, no celebration, nothing cheerful
  adjacent to a death or a delayed pickup. A toast explains what happened; it does not congratulate.

## Changing it

Small, obvious improvements: just do it, in a PR that says what changed and why. Anything touching a
token value or a primitive's API affects everyone's screens — keep it a small standalone PR, do not
bury it inside a feature, and update this file in the same PR.

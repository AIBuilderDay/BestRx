# CLAUDE.md

Guidance for Claude Code working in this repo. **BestRx — "Amazon for DME vendors, for hospices."
A storefront for hospice durable-medical-equipment ordering, with shared delivery visibility and
budget control behind it. Built for the BetterRX Builder Day bounty (Aug 2026).** Frontend-only for
now: React + TypeScript + Vite + Tailwind, pnpm workspace, everything runs through Docker Compose
driven by `task`.

This file is about **how to work here**. Reference material (the product vision, the bounty rules,
the data model, individual specs and tickets) lives in [docs/](docs/) — open it when a task needs
it, not before.

**Start every non-trivial task by reading [docs/PROJECT_DESCRIPTION.md](docs/PROJECT_DESCRIPTION.md).**
It is the master document. If a spec, ticket, or mockup disagrees with it, the project description
wins unless a human says otherwise.

---

## How to work here

This is a hackathon. Bias toward **a working, demoable, honest slice** over completeness. But
hackathon speed is not an excuse for sloppy structure — the judges click through the app, and
BetterRX has said they may build on the winning code.

### Think before coding
- State assumptions explicitly. If uncertain, **ask** — don't guess and run.
- If multiple interpretations exist, surface them; don't silently pick one.
- If you see a simpler or better approach, say so. **Push back when warranted** — you are a
  thinking collaborator, not an order-taker.
- Match planning depth to task size. A one-component change needs a sentence, not a plan.

### Simplicity first
- Minimum code that solves the ticket. Nothing speculative.
- **Reuse before reinventing:** search `src/components/` and `src/lib/` for an existing component
  or helper to extend. A second implementation of something that exists is complexity, not speed.
- No abstractions for single-use code, no config nobody asked for, no error handling for
  impossible scenarios.
- If a senior engineer would call it overcomplicated, simplify it.

### Surgical changes
- Every changed line should trace to the request or the ticket.
- Match existing style even if you'd do it differently. Don't refactor what isn't broken.
- Notice unrelated dead code? Mention it — don't delete it unasked.

### Goal-driven execution
- Turn the task into a verifiable check, then loop until it passes.
- **Evidence before claims:** run it before you say it works (see [Verification](#verification)).
  If something fails, say so with the output. If you skipped a step, say that.

---

## Non-negotiables

- **TypeScript only.** No `.js` or `.jsx` files anywhere in `frontend/src/`. Every module is `.ts`
  or `.tsx`, compiled by Vite. `allowJs` is off and stays off. No `// @ts-nocheck`. `any` needs a
  comment justifying it — prefer `unknown` plus a narrowing check.
- **Use Context7 for docs.** If the Context7 MCP tools are available, query them before writing
  code against React, Vite, Tailwind, or any other library — API surfaces move faster than model
  training data. Verify the API, then write the code. Do not guess at library syntax.
- **Use the design system.** Colors, radii, and the shared primitives live in
  [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), `frontend/src/index.css`, and
  `frontend/src/components/ui/`. Never hardcode a hex value or a one-off radius in a component —
  use a token, or add one. The system is **deliberately basic and expected to change**: if it is
  getting in your way, improve it in a small standalone PR and update
  [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) in the same PR. It is not frozen, but it is also
  not something to quietly work around in one file. Building a chart? Read the Charts section there
  first, and load the `dataviz` skill if it is available.
- **Modular by default.** One job per component/function. Components stay under ~150 lines; split
  when they grow. Data shaping lives in `src/lib/`, not inside JSX. Types live in `src/types/`.
- **Defensive at the boundaries.** Anything reading the JSON "database", parsing dates, or doing
  lookups by id must handle the missing/empty case explicitly and render something sane. Never let
  an `undefined` lookup crash a view. Don't wrap pure logic that can't fail.
- **Every feature answers the buyer's question.** The hospice buyer's question is "how are you going
  to decrease my DME PPD (per patient day)?" Before building a screen, know which PPD lever it pulls
  — see [docs/PROJECT_DESCRIPTION.md](docs/PROJECT_DESCRIPTION.md) §6. Cost figures are shown as PPD,
  not only as monthly totals.
- **No invented clinical or vendor facts in the UI.** Every number, status, and risk factor shown
  must come from `frontend/src/data/` or be derived from it in code. If a value is an assumption,
  label it as one in the UI. This is a judged criterion, not a style preference.
- **Never attribute work to Claude or Fable.** No "Authored by Claude", no "Generated with Claude
  Code", no `Co-Authored-By: Claude` — not in commit messages, not in PR bodies, not in code
  comments. Write commits as the human author would.
- **All changes ship through a PR, via the GitHub CLI.** Branch → commit → `gh pr create`. Never
  commit directly to `main`, never `git push origin main`. Use `gh` for git/GitHub operations
  (`gh pr create`, `gh pr view`, `gh pr checks`). Small PRs keep the history clean and make a bad
  change easy to revert mid-hackathon.

---

## Where to find things

Don't memorize these — open the doc when the task touches it.

| Task touches… | Read |
|---|---|
| What we're building and why (master doc, read first) | [docs/PROJECT_DESCRIPTION.md](docs/PROJECT_DESCRIPTION.md) |
| Colors, spacing, shared UI primitives, tone | [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) |
| PPD — the metric the buyer judges us on, and our five levers | [docs/PROJECT_DESCRIPTION.md](docs/PROJECT_DESCRIPTION.md) §6, [docs/bounty/BOUNTY_FAQ.md](docs/bounty/BOUNTY_FAQ.md) §11 |
| Our own scope decisions: P0/P1/P2, per-view owners | [docs/PROJECT_DESCRIPTION.md](docs/PROJECT_DESCRIPTION.md) §7, [docs/WORKFLOW.md](docs/WORKFLOW.md), [docs/whiteboards/](docs/whiteboards/) |
| Bounty rules, judging rubric, required features | [docs/bounty/BOUNTY_BRIEF.md](docs/bounty/BOUNTY_BRIEF.md) |
| Organizer answers that override the brief (scope, pickup trigger, vendor UX) | [docs/bounty/BOUNTY_FAQ.md](docs/bounty/BOUNTY_FAQ.md) |
| Canonical sample orders from the organizers | [docs/bounty/SAMPLE_ORDERS.md](docs/bounty/SAMPLE_ORDERS.md) |
| Data shapes, table relationships, where the mock DB lives | [docs/DATA_MODEL.md](docs/DATA_MODEL.md) |
| How we work: description → mockup → spec → tickets | [docs/WORKFLOW.md](docs/WORKFLOW.md) |
| A feature's agreed scope before building it | [docs/specs/](docs/specs/) |
| The specific unit of work you were handed | [docs/tickets/](docs/tickets/) |
| What a screen should look like (humans read these, agents skim) | [mockups/](mockups/) — `orders-board.html` and `cost-ledger.html` are the starter templates the design system came from |
| Commands, Docker, ports | `Taskfile.yml` and `docker-compose.yml` — read them, don't memorize |
| App code, components, views | [frontend/src/](frontend/src/) |
| Mock database (JSON tables) | [frontend/src/data/](frontend/src/data/) |

---

## Repo layout

```
BestRx/
├── CLAUDE.md              you are here
├── Taskfile.yml           all commands (wraps docker compose)
├── docker-compose.yml     frontend today; backend slot commented for later
├── pnpm-workspace.yaml    workspace root (frontend is the only package today)
├── docs/                  markdown for agents
│   ├── PROJECT_DESCRIPTION.md   master vision doc
│   ├── DATA_MODEL.md            mock DB shapes
│   ├── WORKFLOW.md              how specs and tickets get made
│   ├── DESIGN_SYSTEM.md         tokens, primitives, tone
│   ├── bounty/                  the organizers' source material
│   ├── whiteboards/             photos of our planning session
│   ├── specs/                   one spec per feature area
│   └── tickets/                 small, self-contained units of work
├── mockups/               HTML mockups for humans
└── frontend/
    ├── Dockerfile
    ├── src/
    │   ├── components/    reusable UI, grouped by domain (ui/ = shared primitives)
    │   ├── views/         one file per screen/route
    │   ├── data/          JSON "tables" + typed loader
    │   ├── lib/           pure helpers (derivation, formatting, risk math)
    │   ├── hooks/         reusable React hooks
    │   └── types/         shared TypeScript types
    └── public/images/     product/equipment/vendor imagery
```

**Markdown is for agents. HTML is for humans.** Specs and tickets are `.md`; mockups are `.html`.

---

## Commands

`task` is the only entrypoint you need. It drives Docker Compose, so the app runs the same way for
everyone.

```bash
task              # list every task
task start        # build + start everything (frontend on http://localhost:5173)
task logs         # tail container logs
task restart      # clean:all, reinstall, start again
task test         # typecheck + unit tests
task clean        # stop containers, drop node_modules
task clean:all    # clean + docker volumes/images + build artifacts
```

Run pnpm directly (from `frontend/`) only when you need something task doesn't cover — adding a
dependency, running a single test file. Install on the host after changing `package.json`, then
`task start` to rebuild the image.

---

## Verification

Before claiming something works:

```bash
task test          # tsc --noEmit + vitest
task start         # then actually load the page and click the path you changed
```

A screenshot-worthy claim ("the risk drawer works") needs the app running and the path exercised —
not just a green typecheck.

---

## Docs follow the code

Before finishing a task, ask: **does this change make a doc wrong?** If yes, fix it in the same PR.

- New feature area, screen, or data table → update
  [docs/DATA_MODEL.md](docs/DATA_MODEL.md) or the relevant spec, and add a row to the table above
  if a future agent would need to find it.
- Renamed or moved a file, task, or type → `grep -rn "<old-name>" --include='*.md' .` and fix every
  hit.
- Bug fixes, small refactors, and dep bumps need no doc change.

---

**Keep this file short. Push reference detail into `docs/`.**

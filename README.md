# BestRx

Amazon for DME vendors, for hospices.

A hospice orders durable medical equipment the way you order anything else: browse, compare on
price, quality, and delivery date, add to cart, assign it to a patient, and watch it arrive. Today
that happens by phone, fax, or one portal per vendor, and nobody finds out an order is late until
the family calls. BestRx puts ordering and delivery status in one place, with budgets the hospice
controls and a risk flag that fires while there is still time to act.

The buyer's question is "how are you going to decrease my DME PPD?" — the average equipment cost to
care for one patient for one day. Price transparency across vendors, fewer paid-for days after a
death, and fewer emergency substitutions are how BestRx answers it. See
`docs/PROJECT_DESCRIPTION.md` section 6.

Built for the BetterRX Builder Day bounty, August 2026.

## Requirements

- Docker (Desktop or Colima), running
- [Task](https://taskfile.dev) 3.x
- Node 22+ and pnpm 11+ (only needed for editor tooling and running tests on the host)

## Getting started

```bash
git clone git@github.com:AIBuilderDay/BestRx.git
cd BestRx
task start
```

The app is served at http://localhost:5173 with hot reload. Source changes on the host are picked up
by the container.

## Commands

| Command | What it does |
| --- | --- |
| `task` | List every available task |
| `task start` | Build and start everything |
| `task stop` | Stop containers |
| `task logs` | Tail container logs |
| `task test` | Typecheck and run unit tests |
| `task build` | Production build |
| `task install` | Install dependencies on the host |
| `task clean` | Stop containers, remove node_modules and build artifacts |
| `task clean:all` | Clean plus Docker volumes, local images, and lockfiles |
| `task restart` | clean:all, reinstall, start again |

## Layout

```
CLAUDE.md            how agents should work in this repo
Taskfile.yml         every command
docker-compose.yml   frontend today, backend slot commented for later
docs/                project description, data model, specs, tickets
mockups/             static HTML mockups
frontend/            React + TypeScript + Vite + Tailwind app
```

## Tech stack

React, TypeScript, Vite, and Tailwind CSS, in a pnpm workspace, running in Docker. TypeScript only:
no JavaScript source files. Data is synthetic JSON in `frontend/src/data/`, shaped so it can become
real database tables later. A Python FastAPI backend can be added under `backend/` when it is
needed. If deployed, the frontend goes to Cloudflare Pages and a future backend to Cloudflare
Workers.

## Documentation

- `docs/PROJECT_DESCRIPTION.md` is the master document. Read it first.
- `docs/DESIGN_SYSTEM.md` covers tokens, shared UI primitives, and tone. It is deliberately basic
  and expected to change.
- `docs/DATA_MODEL.md` describes the mock database.
- `docs/WORKFLOW.md` describes how a mockup becomes a spec, tickets, and a PR.
- `docs/bounty/` holds the organizers' brief, FAQ, and sample orders.

## Contributing

Branch, commit, and open a pull request with the GitHub CLI. Nothing lands on `main` directly.

```bash
git checkout -b feat/orders-board
task test
gh pr create --fill
```

## Data

All data in this repository is synthetic. No real patient, hospice, or vendor information is used or
accepted.

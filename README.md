# BestRx

Shared visibility for hospice durable medical equipment (DME), from order to pickup.

A hospice patient going home needs a hospital bed and oxygen in place before they arrive. A patient
who has died needs their equipment collected quickly and respectfully. Both moments are handled by
an outside DME vendor, outside the hospice's EMR, usually over phone and fax. BestRx puts both sides
of that handoff on one board, and flags an order as at risk while there is still time to act.

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

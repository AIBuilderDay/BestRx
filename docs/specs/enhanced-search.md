# Enhanced Search (AI) — working plan

**Status: BUILT & LIVE-TESTED.** UI + Anthropic wiring + the comet cart hand-off shipped on
`feat/enhanced-search` (PR #15). Verified against the real API with Playwright: re-rank picks
the clinically right item first, agent orders resolve the correct offer + patient in ~1.5–3.6s,
unknown patients safely fall back to search, and the token ledger records every call. Remaining:
the open questions at the bottom.

## What we're building

The top-nav search bar becomes the app's AI surface. One input, two behaviors:

1. **Smart search (re-rank).** A plain query still runs the normal catalog search. But when a
   patient context is in play, an LLM re-orders the catalog results using everything we know about
   the patient — location/ZIP, condition, doctor's notes, urgency — plus the item data (price,
   vendor proximity, delivery speed, rating). The model returns a **re-ordered list of existing
   item IDs** (it never invents items, prices, or ETAs). Goal: the nurse's best option is at the
   top without her having to work the filters.
2. **Agent order.** A natural-language command — "order a hospital bed for the patient in room 4" —
   is parsed by the model into a structured action: patient id + catalog item id + quantity. The
   app resolves it, adds the item to the cart with the patient assigned, and animates it in.
   **Checkout always stays human-confirmed** (bounty safety requirement — no autonomous purchase).

**Fallback is non-negotiable:** any model failure (timeout, bad JSON, key missing) silently falls
back to the plain search with the existing location/price filters. AI is an enhancement layer; the
app never breaks without it.

## Why AI beats the rules baseline (the bounty defense)

The brief scores "AI ROI" at 15% and requires naming the deterministic alternative
([bounty brief §3](../bounty/BOUNTY_BRIEF.md), [project description §11](../PROJECT_DESCRIPTION.md)).
Our position:

- **Baseline named:** sort by distance, then price, then delivery date — the filters we already
  have. That baseline stays in the product and is the fallback path, so the comparison is live in
  the demo, not hypothetical.
- **Why the model wins for re-rank:** the doctor's notes are unstructured text. "Patient is
  bed-bound, stage 4 pressure ulcer risk, home has narrow doorways" changes which bed and which
  mattress is right in ways no filter set expresses. Mapping free-text clinical context to
  equipment choice is a genuine inference problem — the same reason the project description lists
  "product matching from a patient profile" as an AI-earns-its-place case.
- **Why the model wins for agent order:** parsing free-form intent ("order me X for Y") into a
  structured action is exactly the "unstructured → structured" case the project description
  endorses. The rules alternative (keyword matching) breaks on the first synonym.
- **Where rules stay:** filters, budget math, SLA/deadline comparisons, proximity sort. We say so
  in the submission write-up — the brief rewards that.

## Safety rails (required by the brief, scored)

- **Grounded output only:** the model can only return IDs that exist in our JSON tables. Every ID
  in the response is validated against the data before use; unknown IDs are dropped.
- **Human confirms high-stakes actions:** agent order fills the cart; the nurse reviews and clicks
  checkout herself. The model never completes a purchase.
- **No PHI leaves the app:** requests are built from a sanitized context — no patient name, DOB, or
  full address. (Open question below on how coarse location must be.) All data is synthetic anyway,
  but we build the sanitizer as if it were real — that's part of the pitch.
- **Low confidence is shown as low confidence,** not stated as fact ("Suggested for this patient"
  wording, labeled as AI-ranked, with a one-line why per item).

## Token & cost tracking (required data, UI later)

The brief requires a token/compute cost estimate per order/patient, and the cost dashboard will
show AI spend. **We record usage now; the UI comes later (owned elsewhere — do not build it).**

- Every LLM response includes a usage object (e.g. OpenAI returns `usage.prompt_tokens` /
  `completion_tokens` / `total_tokens` in the JSON response). We capture it on every call.
- Persist per-call records: timestamp, feature (`rerank` | `agent_order`), model, prompt tokens,
  completion tokens, computed $ cost (from a model-price table we keep in code), success/fallback.
- Storage: localStorage or a JSON-shaped store consistent with the mock-DB pattern — shape to be
  agreed with whoever owns the cost dashboard (open question).

## UI: the enhanced search bar

**✅ DECIDED (McKay): Option C** — the explicit **Search / ✦ AI** switch inside the bar. Direction
refinements from McKay:

- **Blues only, no purple.** Dark blues → light blues.
- **The AI-mode activation is the showpiece:** clicking ✦ AI triggers a smooth, fancy,
  "rainbow-y but all blues" flowing wave animation — like water/aurora flowing through the bar,
  not a cheap spinner. Inspiration pointers: canvasui.dev / DavidHDev's canvas-ui (+ similar
  libraries), Apple-Intelligence-style edge glow.

Mockup: [mockups/enhanced-search.html](../../mockups/enhanced-search.html) — Option C merged down,
with animation variants to refine. **This file is the standing visual reference for
implementation.**

Signal requirements regardless of which option wins:

- The bar must read as "smart" at a glance (sparkle iconography / glow) but stay inside the
  design system — accent color becomes a token, no hardcoded hex in components.
- Both actions discoverable by a brand-new, untrained nurse (high turnover — guide, don't assume).
- Loading state while the model thinks; visible "AI-ranked" labeling on results; graceful,
  quiet fallback when AI is off/unavailable.
- Works on a phone — field nurses are the primary users of agent order.

## Research notes (findings, not decisions)

### UI patterns for "smart" search bars (web research, Aug 2026)

- **Sparkle needs a label.** NN/g tested the ✦ sparkle icon: zero participants read it as "AI";
  most read star shapes as bookmarking. Every product that works (Algolia, Shopify Sidekick,
  Notion) pairs the sparkle with words ("Ask AI"). Bare-sparkle affordances are also drawing
  "sparkle fatigue" criticism.
- **Explicit opt-in beats silent rerouting.** Amazon Rufus put intent detection behind the normal
  search bar; NN/g found users never noticed the affordances and were jarred when a search became
  a chat. Algolia's counter-model — same box, but "Ask AI" is an explicit row/button you choose —
  is the documented good pattern. Whichever mockup wins, the agent-order path should be an
  explicit, visible action.
- **Glow with restraint.** IBM Carbon for AI (the most systematized "AI styling") uses a subtle
  blue glow + gradient on AI-touched inputs, deliberately limits glow spread for contrast, and
  pairs it with a clickable "AI" label that explains itself. Also: respect
  `prefers-reduced-motion`, and don't make an animated placeholder the only instruction.
- **Standard animation kit:** rotating conic-gradient border (`@property` angle animation — the
  Google "AI Mode" look), soft radial halo on focus (Gemini), shimmer via `background-clip: text`
  for "thinking" states, and cycling example-query placeholders (Algolia ships this as a recipe;
  pause while focused).

### Model / API landscape (web research, Aug 2026 — verify pricing before committing)

- **gpt-4o-mini is retirement-track** (GPT-4o family pulled from ChatGPT Feb 2026; API status
  contested). Don't build new on it. Current cheap tiers: **OpenAI GPT-5 nano / GPT-5.4 mini**,
  **Anthropic Claude Haiku 4.5** ($1/$5 per Mtok, <600ms first token, no thinking latency),
  **Google Gemini Flash-Lite** (cheapest + fastest overall).
- **Structured output:** all three providers do schema-constrained JSON (OpenAI `json_schema`
  strict mode; Anthropic `output_config` json_schema or strict tool use; Gemini `responseSchema`).
  Trick that kills ID hallucination: pass valid patient/item IDs as schema **enums** so the
  constrained decoder literally cannot emit an unknown ID.
- **Token usage comes back on every response** (OpenAI `usage.prompt_tokens/completion_tokens`;
  Anthropic `usage.input_tokens/output_tokens`; Gemini `usageMetadata`). Cost tracking is just
  capturing that field + a price table.
- **Agent order does not need a reasoning model or a multi-turn loop** — it's single-shot slot
  filling (patient id + item id + qty) with a human confirm behind it. Small non-reasoning models
  suffice; reasoning tiers only add seconds of latency.
- **Browser calls:** OpenAI and Gemini allow direct browser fetch; Anthropic needs the
  `anthropic-dangerous-direct-browser-access` header. Cleanest local pattern for our stack: a
  **Vite dev-server proxy** (`server.proxy` injecting the key from a non-`VITE_` env var) — key
  stays out of the bundle, no CORS, no extra service in compose.
- **Cost ballpark for re-rank** (~5–15K tokens in, 1–3K out): fractions of a cent per call on any
  of these models — a demo-friendly number to quote in the AI-ROI write-up.

## How it's built (implemented)

- **✅ Model: Claude Haiku 4.5** (`claude-haiku-4-5`, $1/$5 per Mtok) — decided by McKay.
- **Key handling:** `frontend/.env` (git-ignored) with `ANTHROPIC_API_KEY=sk-ant-...`. The Vite
  dev server proxies `/api/anthropic/*` → `api.anthropic.com` and injects the key server-side
  (`vite.config.ts`) — the key never reaches the browser bundle. The app uses the official
  `@anthropic-ai/sdk` pointed at the proxy.
- **Code layout:** `src/lib/ai/` — `client.ts` (SDK client + price table), `sanitize.ts` (what
  the model may see: no names/DOB/street, ZIP + age + diagnosis only; client-side patient-name
  matching), `rerank.ts` (smart search), `agentOrder.ts` (order commands), `usage.ts` (token
  ledger). Types in `src/types/ai.ts`. UI: `components/layout/NavSearch.tsx` (Option C bar),
  `hooks/useAiRerank.ts`, wiring in `views/Catalog.tsx` + `CartDrawer` highlight.
- **Structured outputs with enum-locked IDs:** both features use JSON-schema constrained output
  where valid offer/patient IDs are schema enums — the model cannot emit an unknown ID. Agent
  order also has an explicit `NO_MATCH` escape so it never guesses; every response is re-validated
  in code anyway.
- **Deterministic router:** in AI mode, `/^(order|add|get|buy|send|place)\b/` routes to the agent;
  everything else is AI-ranked search. No model call to decide intent (rules are right here).
- **Fallbacks:** rerank failure → plain keyword search with a quiet "AI unavailable" note; agent
  failure → plain search; NO_MATCH → AI search of the command text. Nothing ever dead-ends.
- **Token ledger:** every call → localStorage `bestrx.ai_usage.v1` as
  `{feature: 'rerank'|'agent_order', model, inputTokens, outputTokens, costUsd, latencyMs, ok}`;
  `summarizeUsage()` returns per-feature + grand totals for the cost dashboard (UI owned elsewhere).

## Rough build sequence (after decisions)

1. ~~Merge chosen mockup~~ → done: `mockups/enhanced-search.html` (Option C). Refine the AI-wave
   animation there, then add accent token(s) to `tokens.css` + `DESIGN_SYSTEM.html` in a small
   standalone PR.
2. New nav search bar UI (no AI yet) — visual layer + states, behind the existing search behavior.
3. `src/lib/ai/` — client wrapper: sanitizer, prompt builders, JSON-schema validation, usage
   capture, fallback logic. Pure functions, unit-testable without network.
4. Feature 1: re-rank wired into catalog results, with the "AI-ranked" labeling + fallback path.
5. Feature 2: agent order → parse to structured action → validate → add to cart + animation →
   human-confirmed checkout.
6. Token ledger data store + price table; hand shape to the cost-dashboard owner.
7. Submission write-up section: baseline, why AI wins, cost per order, safety rails.

## Open questions — DO NOT treat as decided; ask McKay

1. ~~Provider/model~~ — **✅ decided: Anthropic Claude Haiku 4.5.**
2. ~~Structured output mechanism~~ — **✅ built: JSON-schema structured outputs for both features,
   IDs enum-locked.**
3. ~~Browser call vs proxy~~ — **✅ built: Vite dev-server proxy, key injected server-side.**
4. ~~Key handling~~ — **✅ built: `frontend/.env` + copy/paste (one secret, local-only).**
5. ~~How the two modes are triggered~~ — **✅ decided: explicit Search / ✦ AI switch (Option C).**
6. ~~Location granularity~~ — **✅ built: ZIP only** (see `sanitize.ts`); flag if you want coarser.
7. **Token-ledger shape.** Built as described above — still needs a 5-minute sync with whoever
   owns the cost dashboard so the shape matches their screen.
8. **When re-rank uses patient context.** Built: only when the query names exactly one patient
   (matched client-side). A future global "working patient" selector could feed it instead.
9. ~~Cart animation~~ — **✅ decided & built: streaking comet + burst + gradient-ring landing**
   (`mockups/agent-cart-handoff.html`). In-app: `src/lib/fx/agentComet.ts` flies the comet from
   the bar to the cart icon and fires the burst; the `.agent-added` line in the drawer wears the
   sweeping gradient ring + glow for ~4.8s, then settles (CSS in `index.css`).
10. **Patient doctor's-notes field.** The data model has no free-text clinical notes yet — adding
   one would showcase the re-rank's real advantage over filters.

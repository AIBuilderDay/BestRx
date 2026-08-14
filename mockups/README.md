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
| `orders-board.html` | Hospice orders board | Lifecycle table, stage stepper, risk drawer with explanation and actions |

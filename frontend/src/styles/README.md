# styles

**`tokens.css` is the app's color and radius palette.** It is imported by `src/index.css` and wired into Tailwind via `@theme inline`.

- Visual reference and token names: [docs/DESIGN_SYSTEM.html](../../../docs/DESIGN_SYSTEM.html)
- In components, use Tailwind utilities (`bg-surface`, `text-ink-2`, `border-line`, `bg-solid-bg`, `text-solid-ink`, `rounded-card`, …)
- Do not hardcode hex values or `var(--color-*)` in JSX — change the token once in `tokens.css` (and the design system HTML in the same PR)

---
name: shadcn-first
description: Aruna UI rule — shadcn/ui primitives first, hand-rolled Tailwind markup last. Use when adding UI, reviewing UI, or migrating existing markup toward shadcn. Priority ladder: shadcn primitive > shared custom component > inline classes.
---

# shadcn-first for Aruna

Migrating Aruna toward shadcn/ui primitives as the primary UI source. `components.json` (new-york style, `rsc: true`, `tsx: false`) is the source of truth. Current coverage ~40% — remaining debt is repeated card/chip/banner divs, duplicate progress bars, hand-rolled tabs/segments, hand-rolled sheets, raw HTML stragglers.

## The priority ladder (highest first)

1. **Shadcn primitive exists** → use it. Check `src/components/ui/*` before writing a single Tailwind class. List today: `accordion badge button card chart dialog dropdown-menu input label segmented-control select separator sheet skeleton table tooltip`.
2. **Primitive missing but standard shadcn** → `npx shadcn@latest add <name>` (e.g. `sonner tabs progress command avatar popover`). This is the sanctioned way to grow `ui/`. Never hand-roll something shadcn ships.
3. **Shared custom component** (already exists in `src/components/*`, 3+ call sites) → reuse, don't re-inline.
4. **Inline Tailwind classes** → last resort, only for what no primitive covers (spacing tweaks via `cn()`, page layout, SVG charts).

## Raw-element → primitive mapping

| Hand-rolled | Replace with |
|---|---|
| `<input>` + `rounded-md border bg-background px-3` | `<Input />` (`ui/input`) |
| `<button>` styled like pill/chip/tab | `<Button variant>` or `SegmentedControl` |
| `div.rounded-* border bg-card` data card | `<Card>` (`ui/card`) |
| `span.rounded-* border px-*` pill/chip | `<Badge>` — add variant via `cva` if needed |
| hand-rolled `role="tablist"` / button-group tabs | `SegmentedControl` (exists) or `Tabs` (add via CLI) |
| `title="..."` tooltip | `Tooltip` (`ui/tooltip`) |
| `<details>/<summary>` disclosure | `Accordion` (`ui/accordion`) |
| hand-rolled drawer (`fixed` + `-translate-x-full`) | `Sheet` (`ui/sheet`) |
| `h-* rounded-full bg-muted overflow-hidden` progress bar | `Progress` (add via CLI) — dedupes repeated impls |
| `<dl>/<dt>/<dd>` key-value block | `<Table>` (`ui/table`) or `Label`+text row |
| raw search-results `<ul>` dropdown | `Command`/`Popup` (`ui/command`, add via CLI) |

## Legit custom — do NOT force shadcn

- TradingView `lightweight-charts` (`normal-candlestick-chart.jsx`)
- Recharts internals — `ui/chart.jsx` wrapper is fine, but bespoke SVG gauges (`analyst-gauge-chart`) and sparklines (`mini-chart`, `portfolio-mini-chart`) stay raw SVG — perf over purity.
- `market-bubbles.jsx` SVG — keep, but timeframe toggle → `SegmentedControl`.
- `toast.jsx` → migrate to `sonner` (shadcn's toast) as one dedicated chore — touches ~30 call sites, do it once.

## Workflow

1. **Audit** (`/shadcn-audit`): per page, count UI blocks + shadcn/raw split, list offenders with `file:line`. Write `docs/SHADCN_MIGRATION.md` with phases.
2. **Add missing primitives first** (shared foundation): `npx shadcn@latest add sonner tabs progress command`.
3. **Migrate shared components** (`components/*`) before pages — pages consume them, biggest blast radius per file.
4. **Migrate pages last**, one page per pass, `npm run lint` per page.
5. **Verify**: grep old inline pattern cluster across `src/components` + `src/app` to confirm zero stragglers, then lint.

## Constraints

- Keep Aruna aesthetic: monochrome, quiet, `--radius: .625rem`, no gradients/glow, no new animation libs (see `ui-polish-specialist`). shadcn default classes are neutral — fine.
- `tailwind-merge`'s `cn()` resolves conflicts — don't assume overlap is sprawl until grepped.
- Don't extract a shared component for 1-2 call sites (premature). 3+ is the bar.
- Don't churn dead code — a component flagged for deletion beats one flagged for migration.
- Wiring new shadcn primitives = `npx shadcn@latest add`, never `npm i` a radix package by hand.
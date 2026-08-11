# Shadcn Migration Plan

Audit date: 2026-08-12. Goal: shadcn/ui primitives as primary UI source across all pages, same layout template, zero visual regression. Ruleset: `.claude/skills/shadcn-first/SKILL.md`.

## Coverage

| Page/component | Lines | Shadcn | Hand-rolled | Biggest offenders |
|---|---|---|---|---|
| `src/app/explore/page.jsx` | 1425 | ~15% | ~85% | `MarketSymbolCard` divs (345, 374), status pill (1323), screener panel (1369), marquee pills (482, 1117) |
| `src/app/watchlist/page.jsx` | 499 | ~35% | ~65% | SectionHeader (50), highlights rows (413-448), install block |
| `src/app/chart/page.jsx` | 2785 | ~55% | ~45% | info tabs (2681-2697), quarter filter (2584-2597), 4x progress bars (1279, 1727, 1887, 2124), price-target cards (1754-1786), `title` tooltips (479, 496, 543) |
| `src/app/portfolio-tracker/page.jsx` | 1042 | ~55% | ~45% | holding rows (893-983), `<details>` expanders (702, 740), search dropdown (91-103), FX box (788) |
| **Total** | **5751** | **~40%** | **~60%** | |

Coverage method: distinct UI blocks counted (button, input, card, tab, badge, dialog, dropdown, table row, progress bar) — shadcn vs inline Tailwind.

## Keep (no shadcn equivalent, do not touch)

- `normal-candlestick-chart.jsx` — TradingView lightweight-charts wrapper
- `analyst-gauge-chart.jsx`, `mini-chart.jsx`, `portfolio-mini-chart.jsx` — raw SVG, perf over purity
- `market-bubbles.jsx` — SVG ok; timeframe toggle → `SegmentedControl` (bubbles/chart area stays)
- `ticker-avatar.jsx` — `<img>` avatar, no `ui/avatar` prim; optionally add `avatar` via CLI to wrap
- `trending-marquee.jsx` — marquee animation is CSS; pill inner items get `Badge` where it reads

## Unresolved questions

1. **toast.jsx → sonner?** ~30 call sites. sonner = canonical shadcn toast, kills `docs/` + `components/toast.jsx`. Worth it — prefer yes.
2. **`ui/chart.jsx` (recharts) adoption?** chart page imports recharts directly. Wrapping is churn with low visual value; bespoke gauges don't fit. Recommend: keep direct recharts for now.
3. **Chart info-tabs → `Tabs` or `SegmentedControl`?** The info tablist (2681) and quarter filter (2584) are button-group style: recommend existing `SegmentedControl`, don't add `Tabs` unless pill-tab look wanted.

## Phases

Ordered by dependency + blast radius (shared first, pages last).

### P1 — Foundation: add missing primitives
Goal: unblock everything downstream.
- [x] `npx shadcn@latest add sonner tabs progress command` — P0, S
- [x] Wire sonner `Toaster` into root layout — P0, S, `src/app/layout.jsx`

### P2 — Shared components (biggest call-site blast radius first)
Goal: kill hand-rolled UI in `components/*` before pages touch them.
- [x] `toast.jsx` → sonner, migrate all `toast()` imports — P0, M, ~30 files (`src/components/*`, pages)
- [x] `account-sidebar.jsx` drawer → `Sheet` (374) — P1, M
- [x] chart page tooltip `title` attrs → `Tooltip` (479, 496, 543) — P1, S, `src/app/chart/page.jsx`
- [x] `market-bubbles.jsx` timeframe toggle → `SegmentedControl` — P1, S
- [x] `header-symbol-search.jsx` `<ul>` results + history chips → `Command`/chip wrap — P2, M
- [x] `add-asset-modal.jsx` search-result `<button>` rows → same `Command` pattern — P2, S

### P3 — Page sweeps, lowest hand-rolled debt first
Goal: pages fully shadcn-blocked. One page per pass, lint per pass.

- [x] **portfolio-tracker** — `<details>` + `<summary>` expanders ×2 → `Accordion` (702, 740); inline `AddAssetForm` search dropdown → `Command` — P1, M
  - Skipped: guest banner / FX box / holding rows → `Card` — `card.jsx` here is an unstyled `flex flex-col` div, converting adds zero classes/padding, pure churn.
- [x] **chart** — governance/analyst/margin bars ×3 → `Progress` (deduped the 4th impl died too); quarter filter (2584) → `SegmentedControl`; info tabs (2681) → radix `Tabs` `variant="line"` (keyboard roving + aria); log-scale + Livermore toggles → `DropdownMenuCheckboxItem` — P1, M
  - `progress.jsx` extended with `indicatorClassName` (one prop) to support per-bar colors.
  - Skipped: price-range bar (absolute range + markers, not a progress value); `<dl>` key-value grids → `Table` (already semantic, Table wrapper = churn); chart-type switcher → `RadioGroup` (dot ≠ emerald check, parity risk); price-target stat blocks → `Card` (unstylized primitive).
- [x] **watchlist** — no actionable debt: highlights rows are bare flex, install button already `Button`, manage dialog already shadcn. `SectionHeader` (50) = dedupe opportunity, not shadcn scope.
- [x] **explore** — status pill (1323) → `Badge` — P2, L
  - Skipped: `MarketSymbolCard` is a `<Link>` styled card — `Card` is a div, no `asChild`; marquee pills + section headers are component/dedupe scope, not primitives.

### P4 — Verify
Goal: confirm zero stragglers + docs sync.
- [x] Grep old inline pattern clusters (`rounded-* border`, `border-input bg-background`, raw `<input`/`<button>`) across `src/components` + `src/app` — no raw `<input>`, `<details>/<summary>` reordered, `ToastViewport` gone, remaining `title=` are SVG-icon semantics / data prop names, not tooltips
- [x] `npm run lint`, `npm run build` — both pass
- [x] Update `docs/ui-architecture.md`, `docs/known-issues.md`, `docs/ai-session-handoff.md` — P2, S

## P5 — Follow-up (tabs polish + medium components)

- [x] Chart info-tabs label size — `text-sm` (14px, TabsTrigger base) silently won over custom `text-1xs` (11px) because `tailwind-merge` can't resolve custom theme utilities → forced `text-[11px]`
- [x] Chart tab content "information" blocks → `Table`: Trading Snapshot (1405), Upcoming Events (2015), Financial Health (2052). Right-aligned values, row dividers, hover
- [x] `money-flow-card` — `SignalBadge`/`RiskBadge` raw spans → `Badge` variants (added `accumulation`/`highrisk` to `badge.jsx` cva); Gross/Net toggle → `SegmentedControl`
- [x] `chart-trading-plan-panel` — 3 raw `<label>` → `<Label>`
- [x] `ticker-row` `NEW` pill → `Badge variant="new"`
- Skipped: remaining `<dl>` grids are 2-col dense layouts (profile facts, summary stats, ROE/ROA) — single-col Table flattens mobile density; seasonality heatmap `<table>` keeps sticky-col + inline cell styling (`ui/table` container would fight them); marquee/SectionHeader dedupe is `tailwind-cleanup` scope, not primitives
- Validation: `npm run lint` clean, `npm run build` passes, 6 pages return 200 on dev smoke (root, chart, explore, portfolio-tracker, watchlist, idx-bubbles)
---
description: Audit shadcn/ui coverage and build a phased migration plan
---

Run `shadcn-migrator` in read-only audit mode across the UI surface: `src/app/explore/page.jsx`, `src/app/watchlist/page.jsx`, `src/app/chart/page.jsx`, `src/app/portfolio-tracker/page.jsx`, plus all custom components in `src/components/*` (excluding `ui/`).

Output `docs/SHADCN_MIGRATION.md` with:

1. **Coverage table** — per page/component: line count, shadcn %, biggest offenders `file:line`.
2. **Phase list** ordered by dependency and blast radius:
   - P1 Foundation: `npx shadcn@latest add sonner tabs progress command` (blocks the later phases).
   - P2 Shared components with the most call sites (e.g. `toast.jsx` → sonner migration).
   - P3 Hand-rolled drawer / unused-primitive gaps (`account-sidebar` → `Sheet`, tooltip `title` attr → `Tooltip`, `ui/chart.jsx` wrapper adoption where justified).
   - P4 Page sweeps last — the four pages in order of lowest-to-highest hand-rolled debt: `portfolio-tracker`, `chart`, `watchlist`, `explore`.
   - Each item: `- [ ] item — file(s) touched`, effort S/M/L, priority P0/P1/P2.
   - Mark anything shadcn-ifying would be wrong (SVG charts, TradingView wraps) as **keep** with one line of why.
3. **Unresolved questions** — judgment calls needing the user (e.g. toast → sonner touches ~30 call sites, worth it?; adopt `ui/chart.jsx` recharts wrapper or keep bespoke gauges?).

Read-only — do not edit source code. `/shadcn-audit` is the analysis pass, `/execute-phase` or the `shadcn-migrator` agent is for running it.
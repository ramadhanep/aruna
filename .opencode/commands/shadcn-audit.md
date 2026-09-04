---
description: Audit UI primitive coverage and build a phased migration plan
---

Run the UI migration audit in read-only mode across the UI surface: `src/app/explore/page.jsx`, `src/app/watchlist/page.jsx`, `src/app/chart/page.jsx`, `src/app/portfolio-tracker/page.jsx`, plus all custom components in `src/components/*` (excluding `ui/`).

Output the shadcn migration report with:

1. **Coverage table** — per page/component: line count, primitive %, biggest offenders `file:line`.
2. **Phase list** ordered by dependency and blast radius:
   - P1 Foundation: missing shared primitives (blocks later phases).
   - P2 Shared components with the most call sites (e.g. `toast.jsx` migration).
   - P3 Hand-rolled drawer / unused-primitive gaps (`account-sidebar` → `Sheet`, tooltip `title` attr → `Tooltip`, `ui/chart.jsx` wrapper adoption where justified).
   - P4 Page sweeps last — the four pages in order of lowest-to-highest hand-rolled debt: `portfolio-tracker`, `chart`, `watchlist`, `explore`.
   - Each item: `- [ ] item — file(s) touched`, effort S/M/L, priority P0/P1/P2.
   - Mark anything primitive-ifying would be wrong (SVG charts, TradingView wraps) as **keep** with one line of why.
3. **Unresolved questions** — judgment calls needing the user (e.g. toast migration touches ~30 call sites, worth it?; adopt `ui/chart.jsx` recharts wrapper or keep bespoke gauges?).

Read-only — do not edit source code. This is the analysis pass; execution happens in the migrator agent.
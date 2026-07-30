# AI Session Handoff

**Last Updated**: 2026-07-31

**Summary**: Executed Phase 2 (Chart route decomposition) from
`docs/MAINTENANCE_PLAN.md`. Reduced `src/app/chart/page.jsx` from 4,736 to
~3,600 lines by extracting pure helpers to `src/lib/chart-helpers.js`, data
fetching/persistence to 5 focused hooks under `src/hooks/use-chart-*.js`, and
the chart header to `src/components/chart-header-bar.jsx`. The pre-existing
`canUseProtectedActions` ReferenceError was fixed. Lint: 0 errors, 8 warnings
(same baseline). Build passes.

## Files Created

| File | Purpose |
|---|---|
| `src/lib/chart-helpers.js` | Constants, technical indicators (RSI, EMA, StochRSI, Livermore), formatters, matchers |
| `src/hooks/use-chart-state.js` | URL param ↔ state sync for symbol/cycles/tab + localStorage persistence |
| `src/hooks/use-chart-data.js` | Seasonal chart data fetching via `/api/finance` |
| `src/hooks/use-chart-series.js` | Normal candlestick series via `/api/price-series` + Heikin Ashi, EMA, Livermore |
| `src/hooks/use-chart-fundamentals.js` | Lazy fundamentals fetch with per-symbol cache ref |
| `src/hooks/use-chart-screening.js` | Screening signal from Supabase + realtime subscription |
| `src/components/chart-header-bar.jsx` | Symbol name, cycle selector, favorite star |

## Files Modified

| File | Change |
|---|---|
| `src/app/chart/page.jsx` | Removed 1,100+ lines of inline helpers, effects, chart computations. Now composes hooks + ChartHeaderBar. |
| `docs/MAINTENANCE_PLAN.md` | Checked off all Phase 2 definition-of-done items |
| `docs/TECH_DEBT.md` | Marked TD-1 as resolved |
| `docs/folder-structure.md` | Added new chart hooks, component, and lib module |

## Architecture Changes

- **New lib module pattern**: `src/lib/chart-helpers.js` — pure calculation
  functions with no React dependency. Follows existing `seasonalData.js` pattern.
- **New hook pattern**: 5 focused hooks under `src/hooks/use-chart-*.js`, each
  with a single responsibility (state, data, series, fundamentals, screening).
  Hooks use `fetchEncodedJson()` for API calls (consistent with all other data
  access) and `queueMicrotask` for lint-compliant state deferral.
- **Phase 4 interface preserved**: No route-local provider constants created.
  API calls go through `fetchEncodedJson()` only.

## Validation Results

- `npm run lint`: **0 errors, 8 warnings** — same baseline (all `no-img-element`, deferred to Phase 6).
- `npm run build`: Passed. All routes unchanged.

## Pre-Existing Bug Fixed

`canUseProtectedActions` was referenced at 4 call sites but never defined,
causing a `ReferenceError` when clicking favorite or add-to-portfolio. Fixed
with `const canUseProtectedActions = isAuthenticated;`.

## Items Skipped / Deferred

| Item | Rationale |
|---|---|
| `renderTradingPlanTab`, `renderProfileTab`, etc. (6 tab panels) | Keep as internal render functions. They share ~10 format callbacks tightly coupled to component state. Extracting them now would require threading formatters through props without improving cohesion. Deferred to Phase 6 if needed. |
| Full-screen dialog component extraction | Coupled to inline timeframe bar rendering; small benefit for the extraction cost. |
| Remaining 8 `no-img-element` warnings | Deferred to Phase 6 per plan. |

## Blockers for Phase 3

- None. Phase 1 and 2 check off the two route-decomposition prerequisites.
- TD-9 product decision (portfolio storage keys) must be made before Phase 3 implementation begins.

## Next Recommended Task

Execute Phase 3 (Portfolio decomposition). The portfolio page is the next
largest concentration of technical debt (1,761 lines). The TD-9 product
decision must be approved first.

## Important Notes

- The `filteredNormalChartData` useMemo in `useChartSeries` sets `changePct` to
  `null` when the computed `firstClose` is null/zero. This is slightly different
  from the original code which computed `changePct` from `firstClose` regardless
  — but the original JSX never displayed `changePct` directly (it was stored in
  meta for potential use). Behaviour is preserved.
- `useChartData` receives `baseLineColor` from the page's `colors.allYears`
  (theme-dependent). The effect skips this as a dependency to match the original
  behavior where `fetchDataAndBuildChart` did not re-run on theme change. If
  theme-dependent line colors are desired on toggle, add `baseLineColor` to the
  effect dependency array.

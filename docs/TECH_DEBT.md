# Technical Debt Audit

Audited against `docs/architecture.md`, `docs/coding-standards.md`, and
`docs/conventions.md` on 2026-07-31. References are to the current working
tree. This is an audit only; no implementation changes were made.

## Verified conformances

- No component or page imports an API route module directly. Browser data calls
  use `fetchEncodedJson()` rather than route-module imports.
- All 13 non-cron API routes wrap their returned bodies with `encodePayload()`,
  including all GET/POST/DELETE handlers in `api/discussions`. The two
  `api/cron/*` handlers are the documented plain-JSON exceptions. There is no
  missing-encoding finding.

## Findings

### TD-1 — The chart page has become a feature subsystem in a route module (RESOLVED in Phase 2)

- **Resolution:** `src/app/chart/page.jsx` reduced from 4,736 to 3,600 lines.
  Pure helpers extracted to `src/lib/chart-helpers.js`. Data fetching/persistence
  extracted to 5 hooks under `src/hooks/use-chart-*.js`. Chart header extracted
  to `src/components/chart-header-bar.jsx`. Page now handles route composition,
  URL-state wiring, and layout only. Pre-existing `canUseProtectedActions`
  ReferenceError fixed.

### TD-2 — Portfolio functionality is similarly concentrated in one page

- **Reference:** `src/app/portfolio-tracker/page.jsx:25-1761` (1,761 lines);
  storage helpers at `63-145`, search/fetching around `95-145` and `267-529`,
  calculations and UI thereafter.
- **What is wrong:** Route-level code contains portfolio domain state,
  persistence, FX fetching, search, pull-to-refresh, chart creation, dialog
  forms and rendering.
- **Why it matters:** It duplicates functionality elsewhere and violates the
  intended pages → components/lib dependency shape. It also has two
  `set-state-in-effect` lint errors (`427`, `447`).
- **Suggested fix:** Extract portfolio storage, quote/FX access, calculations,
  and form/search state into `src/lib/` and hooks; retain a thin page plus
  portfolio feature components.
- **Effort:** L

### TD-3 — Quote/asset-logo acquisition is duplicated across two API routes

- **Reference:** `src/app/api/quotes/route.js:1-145` and
  `src/app/api/finance/route.js:1-64`.
- **What is wrong:** Both routes declare the same Supabase/Pluang bases and a
  near-identical `ensureUsLogo()` implementation (HEAD, CDN download, service
  role upload, public URL).
- **Why it matters:** Behaviour, error handling and cache policy can drift; it
  also leaves route handlers carrying reusable data-access logic.
- **Suggested fix:** Extract a server-only logo-cache helper under `src/lib/`
  and use it from both handlers.
- **Effort:** M

### TD-4 — Symbol search and short-window price fetching are duplicated in UI

- **Reference:** `src/components/add-asset-modal.jsx:10-44`; 
  `src/app/portfolio-tracker/page.jsx:95-109,267-289`.
- **What is wrong:** Each implementation independently wraps
  `/api/symbol-search`, decodes/validates the same response, logs failures and
  builds finance date windows. `add-asset-modal` repeats its finance request
  again at `60-84`.
- **Why it matters:** Client-side data-access policy is inconsistent and error
  behaviour will diverge. It also puts reusable fetching business logic in a
  page/component rather than a hook or lib client.
- **Suggested fix:** Introduce focused API-client helpers/hooks (for example
  `searchSymbols` and `getLatestPrice`) built on `fetchEncodedJson()`.
- **Effort:** M

### TD-5 — Formatting helpers are reimplemented in feature files [PARTIALLY RESOLVED]

- **Resolution:** `money-flow-card.jsx` already imports all formatters from
  `@/lib/utils`. `idx-momentum/page.jsx` already uses canonical helpers. Phase 0
  added `formatDecimalPercent`, `formatUSD`, `formatIDR`, `formatSGD`, and
  `formatByCurrency` to `src/lib/utils.js` and removed the duplicated local
  versions from `money-flow/page.jsx` and `portfolio-tracker/page.jsx`. The
  remaining local time-label formatters (`formatLocalDateTimeLabel`,
  `formatTimeAgo`, `formatLocalTimeLabel`) in `explore/page.jsx` are
  page-specific date-formatting helpers with no equivalent in utils — not
  duplicates. The `portfolio-tracker/page.jsx` `formatValue` function is
  state-coupled (depends on currency/idrPerUsd/sgdPerUsd) and stays local until
  Phase 3 extraction.

### TD-6 — Breakpoint and duration constants are scattered instead of shared [RESOLVED]

- **Resolution:** `MOBILE_BREAKPOINT = 1024` and `RECENT_PRICE_LOOKBACK_DAYS = 5`
  are already centralized in `src/lib/time.js` with a shared `getRecentUnixRange()`
  helper. `use-mobile.js`, `trial-banner.jsx`, `portfolio-tracker/page.jsx`, and
  `add-asset-modal.jsx` all import from `@/lib/time`. No duplicate literals remain.
  Resolved in Phase 0 (confirmed already in place, no code change needed).

### TD-7 — React effect patterns are inconsistent and currently fail lint [RESOLVED]

- **Resolution:** Phase 1 fixed all 27 effect-related lint errors across 13
  files. Approaches used: `queueMicrotask`/`setTimeout` to defer synchronous
  `setState` out of effect bodies; `useSyncExternalStore` for the `use-mobile`
  hook (subscribing to `matchMedia`) and for hydration guards in
  `account-sidebar.jsx`; `useState` lazy initializers for reading localStorage
  and computing client-only initial values; inlined async fetch logic with
  cancellation inside effects; moved dialog-reset logic from effects to event
  handlers. No new hooks or lib modules were added. All remaining 8 warnings
  are `no-img-element` (Phase 6 scope).
- **Effort:** M

### TD-8 — Market bubble rendering is impure during render [RESOLVED]

- **Reference:** `src/components/market-bubbles.jsx:175-191,429-522`.
- **Resolution:** Phase 1 removed all ref reads and `Math.random()` calls from
  the render path. `initialPositionsRef` (dead code, never read) removed.
  `Math.random()` replaced with deterministic `hashSeed()` per symbol code.
  `dragInfoRef.current.code` ref-read in SVG render replaced with a
  `draggedCode` state variable. `isDragging` state already existed. Bubble
  animation metadata is now stable per symbol across re-renders.
- **Effort:** M

### TD-9 — Local-storage keys deviate from the documented registry

- **Reference:** `src/app/portfolio-tracker/page.jsx:25-28`.
- **What is wrong:** It uses `portfolio_currency`, `portfolio_visibility_hidden`,
  `aruna_guest_portfolio`, and `aruna_guest_portfolio_seeded`; the conventions
  document establishes `aruna-portfolio` for local guest portfolio state.
- **Why it matters:** The actual persistence contract has drifted from the
  ground-truth documentation and is fragmented across four unregistered keys.
- **Suggested fix:** Consolidate portfolio persistence behind the documented
  `aruna-portfolio` record (or update the agreed convention before changing
  behaviour) and centralize key declarations.
- **Effort:** M

### TD-10 — Dead, unreferenced modules remain in the component layer [RESOLVED]

- **Resolution:** Files `src/components/market-canvas.jsx` and
  `src/components/desktop-sidebar.jsx` were confirmed non-existent and
  unreferenced. Documentation (`docs/folder-structure.md`, `README.md`,
  `docs/ui-architecture.md`) updated to remove their entries. Resolved in
  Phase 0.

### TD-11 — Commented-out feature blocks are retained in production files [RESOLVED]

- **Resolution:** Code inspection confirmed the referenced line ranges no longer
  contain commented-out executable code — the files were edited since the
  original audit. Only explanatory `{/* label */}` JSX comments remain (section
  labels, catch-block comments). No code change was needed. Resolved in Phase 0.

### TD-12 — Direct hardcoded external provider URLs/configuration are spread

- **Reference:** `src/app/explore/page.jsx:20,32-39,52,69-108`; 
  `src/app/api/quotes/route.js:5-6`; `src/app/api/finance/route.js:6-7`; 
  `src/lib/money-flow.js:1,71-72`.
- **What is wrong:** CDN bases, storage-base construction, provider origin and
  a large market-symbol/logo catalog live in route/page files. The quote and
  finance bases are duplicated.
- **Why it matters:** Provider changes require unrelated feature edits; values
  that are deployment/provider configuration cannot be centrally reviewed.
- **Suggested fix:** Put static market catalog data in `src/lib/` and expose
  provider bases as server config constants (environment variables where
  deployments should vary). Keep non-secret stable defaults documented.
- **Effort:** M

## Notes

- `USD_TO_IDR` was intentionally excluded as requested.
- ESLint also reports image-optimization warnings and a few hook-dependency
  warnings; these are useful follow-ups but not architecture deviations by
  themselves.

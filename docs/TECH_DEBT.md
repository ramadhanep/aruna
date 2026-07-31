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

### TD-2 — Portfolio functionality is similarly concentrated in one page (RESOLVED in Phase 3)

- **Resolution:** `src/app/portfolio-tracker/page.jsx` reduced from 1,761 to 1,188 lines.
  Persistence extracted to `src/lib/portfolio-storage.js`. Pure calculations extracted to
  `src/lib/portfolio-metrics.js`. Data orchestration extracted to
  `src/hooks/use-portfolio-data.js`. `PortfolioMiniChart` extracted to
  `src/components/portfolio-mini-chart.jsx`. Page now composes hooks and lib modules;
  remaining inline code is UI state (dialog, form, search, sort) and JSX layout.

### TD-3 — Quote/asset-logo acquisition is duplicated across two API routes (RESOLVED in Phase 4)

- **Resolution:** `ensureUsLogo()` extracted to `src/lib/logo-cache.js` as the
  single server-only implementation (HEAD check → Pluang CDN download →
  service-role upload → public URL, null on failure). Both
  `src/app/api/quotes/route.js` and `src/app/api/finance/route.js` import it.
  Shared storage/CDN bases moved to `src/lib/supabase-storage.js`. Encoded
  response shapes and logo URLs verified unchanged via live API smoke test.

### TD-4 — Symbol search and short-window price fetching are duplicated in UI (RESOLVED in Phase 4)

- **Resolution:** `searchSymbols()` and `fetchLatestQuote()` added to
  `src/lib/api-client.js`. All duplicate wrappers removed:
  `add-asset-modal.jsx`, `portfolio-tracker/page.jsx`, `use-portfolio-data.js`
  (including FX lookups), `manage-watchlist-dialog.jsx`, and
  `header-symbol-search.jsx` (abort-aware) now use the shared helpers.
  Also removed the page-local mini-series effect in `portfolio-tracker/page.jsx`
  that duplicated `use-portfolio-data.js`'s identical effect (double fetch).
  `searchSymbols` is tolerant (returns `[]`, rethrows only `AbortError`);
  this also fixed an unhandled-rejection path in `add-asset-modal`.
  Chart seasonal/series and portfolio mini-series fetches remain separate
  contracts by design.

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

### TD-9 — Local-storage keys deviate from the documented registry (RESOLVED)

- **Resolution:** Implemented in Phase 3. `src/lib/portfolio-storage.js` handles
  canonical `aruna-portfolio` schema with one-time migration from legacy keys.
  `ClearDataButton` imports `PORTFOLIO_STORAGE_KEYS` from the adapter for a
  single source of truth. No dual-write or permanent compatibility layer.
  All persistence centralized behind the adapter.

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

### TD-12 — Direct hardcoded external provider URLs/configuration are spread (RESOLVED in Phase 4)

- **Resolution:** `src/lib/supabase-storage.js` is the single source for
  `SUPABASE_STORAGE_BASE` (derived from existing `NEXT_PUBLIC_SUPABASE_URL`),
  `PLUANG_CDN_BASE`, `getIdxLogoUrl()`, and `getUsLogoUrl()`. All 7 inline
  storage-base constructions removed: `quotes`, `finance`, `momentum`,
  `msci`, `money-flow`, `market-bubbles`, `explore`. No new env surface;
  `PLUANG_CDN_BASE` stays a stable code constant. The `explore/page.jsx`
  market catalog was deliberately left in the page: it carries lucide icon
  components and accent colors (presentation data), and extracting it to
  `src/lib/` would violate the documented "lib has no dependencies on
  components" rule. It is single-consumer; only its storage-base literal was
  centralized.

## Notes

- `USD_TO_IDR` was intentionally excluded as requested.
- ESLint also reports image-optimization warnings and a few hook-dependency
  warnings; these are useful follow-ups but not architecture deviations by
  themselves.

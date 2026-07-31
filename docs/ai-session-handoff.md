# AI Session Handoff

**Last Updated**: 2026-07-31

**Summary**: Executed Phase 4 (Shared data access & provider configuration —
TD-3, TD-4, TD-12) from `docs/MAINTENANCE_PLAN.md`. Server logo caching
centralized, client symbol-search/latest-price access centralized, and all
inline storage/CDN provider bases moved to a single config module. All 7
storage-base literal sites and 2 duplicate `ensureUsLogo()` implementations
removed. Lint: 0 errors, 8 warnings (same baseline). Build passes. Live API
smoke test verified unchanged encoded response shapes and logo URLs.

## Files Created

| File | Purpose |
|---|---|
| `src/lib/supabase-storage.js` | Single source: `SUPABASE_STORAGE_BASE`, `PLUANG_CDN_BASE`, `getIdxLogoUrl()`, `getUsLogoUrl()`. Safe in server + client bundles (NEXT_PUBLIC env). |
| `src/lib/logo-cache.js` | Server-only `ensureUsLogo()` — HEAD check → Pluang CDN download → service-role upload → public URL, null on failure. Importable only from API routes. |

## Files Modified

| File | Change |
|---|---|
| `src/app/api/quotes/route.js` | Removed inline `ensureUsLogo` + base constants; imports shared modules. Logo URLs via `getIdxLogoUrl`/`getUsLogoUrl`. |
| `src/app/api/finance/route.js` | Same as quotes. |
| `src/app/api/momentum/route.js` | `logo_url` via `getIdxLogoUrl`. |
| `src/app/api/msci/route.js` | `logo_url` via `getIdxLogoUrl`. |
| `src/lib/api-client.js` | Added `searchSymbols(query, { signal })` and `fetchLatestQuote(symbol)` → `{ price, logo, name }`. |
| `src/components/add-asset-modal.jsx` | Removed local `searchSymbols`/`fetchPrice`/inline init fetch; uses shared helpers. |
| `src/app/portfolio-tracker/page.jsx` | Removed local `searchSymbols`/`fetchSymbolPrice` AND the page-local mini-series effect that duplicated `use-portfolio-data.js` (was double-fetching). |
| `src/hooks/use-portfolio-data.js` | Removed local `fetchPrice`; FX refresh via `fetchLatestQuote('IDR=X'/'SGD=X')`. |
| `src/components/manage-watchlist-dialog.jsx` | Inline search → `searchSymbols`. |
| `src/components/header-symbol-search.jsx` | Inline search → `searchSymbols` with abort signal preserved. |
| `src/components/market-bubbles.jsx` | Logo href via `getIdxLogoUrl`. |
| `src/app/explore/page.jsx` | Storage-base literal → `SUPABASE_STORAGE_BASE` import. Market catalog intentionally stays in page (presentation data with icons). |
| `src/lib/money-flow.js` | `icon_url` via `getIdxLogoUrl`. |

## Architecture Changes

- **Server logo cache**: `src/lib/logo-cache.js` is the one `ensureUsLogo`
  implementation (finance route's richer-logging variant). Imports
  `supabase-server.js` (service role) + `supabase-storage.js`; only API routes
  may import it — never client code.
- **Client API helpers**: `searchSymbols` is tolerant (returns `[]` on
  failure, rethrows `AbortError`). `fetchLatestQuote` is a narrow latest-quote
  contract (`{ price, logo, name }`, null on failure) and is explicitly NOT a
  generic market-data abstraction — series/seasonal/historical fetches
  (`use-chart-data.js` 1971-window, `use-chart-series.js` price-series,
  `use-portfolio-data.js` mini-series) are separate contracts and were left
  untouched.
- **Config single source**: `supabase-storage.js` holds all storage/CDN bases
  and logo-URL builders. `PLUANG_CDN_BASE` is a stable code constant (not env);
  storage base derives from existing `NEXT_PUBLIC_SUPABASE_URL`. No new env
  vars → `.env.template`/`docs/environment.md` unchanged.

## Validation Results

- `npm run lint`: **0 errors, 8 warnings** — same baseline (all `no-img-element`, deferred to Phase 6).
- `npm run build`: Passed at each phase boundary. All routes unchanged.
- Live API smoke test (local dev server, decoded XOR payload): `/api/finance`
  AAPL and `/api/quotes` AAPL/BBCA.JK/BTC-USD return correct logo URLs
  (`us/AAPL.svg`, `idx/BBCA.png`), unchanged envelope shape. `/api/symbol-search`
  returns 200. `/explore` and `/portfolio-tracker` render 200.

## Bugs Fixed (discovered during implementation)

- `add-asset-modal.jsx` local `searchSymbols` threw on failure → unhandled
  rejection in its debounce effect. Shared tolerant helper resolves it.
- `portfolio-tracker/page.jsx` carried a full duplicate of the hook's
  mini-series builder (double fetch + write race on the same state). Removed;
  hook owns the mini-series.

## Items Skipped / Deferred

| Item | Rationale |
|---|---|
| Explore market catalog extraction | Single-consumer presentation data (lucide icons, accent colors); moving to lib violates the lib→components layer rule. Only its storage-base literal was centralized. |
| Chart seasonal (`use-chart-data`), chart series (`price-series`), portfolio mini-series fetches | Distinct data-window contracts, not latest-quote lookups; intentionally not folded into `fetchLatestQuote`. |
| New env vars for Pluang CDN base | Stable provider default; code constant is the right surface. Documented in `docs/integrations.md`. |
| `docs/conventions.md` `sidebar_state` cookie-vs-localStorage fix | Not P4 scope (flagged in PHASE_EXECUTION_PLAN). |
| `ClearDataButton` `aruna_watchlist` underscore-key bug | Watchlist domain, not P4 scope. |

## Blockers for Next Phase

- None. Phase 5 (UI polish) can proceed when ready. Per the sequencing rules,
  Phase 4's client helper contracts are settled, so P5/P6 UI data-state work
  can now build on them.

## Next Recommended Task

Execute Phase 5 (UI polish system — skeletons, motion, bottom-nav redesign)
from `docs/MAINTENANCE_PLAN.md`.

## Important Notes

- `supabase-storage.js` must never import from `src/app` or `src/components`.
- `logo-cache.js` bundles the service-role client; keep it imported only from
  API routes to avoid client-bundle pollution.
- `fetchLatestQuote` returns `{ price, logo, name }`; consumers needing just a
  price read `quote?.price ?? null`.
- `use-portfolio-data.js` still calls `fetchEncodedJson` directly for the
  mini-series 45-day fetch — that is a series contract, intentionally not
  consolidated.

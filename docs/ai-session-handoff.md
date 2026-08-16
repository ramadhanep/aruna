# AI Session Handoff

**Last Updated**: 2026-08-15

## i18n — Internationalization with `next-intl`

- `next-intl@4.13.6` installed; wired `next-intl/plugin` in `next.config.mjs`
  and `NextIntlClientProvider` + `getLocale()` in root `layout.jsx`.
- `src/i18n/request.js` resolves the `locale` cookie (`en` default, `id` opt-in)
  and statically merges per-namespace JSON catalogs from
  `messages/{en,id}/` into a single message map.
- Migrated all 14 pages + shared components (watchlist, explore, account-sidebar,
  chart, msci, portfolio-tracker, money-flow, idx-*, discussion, signin, offline,
  tools, ticker-row, manage-watchlist-dialog, add-asset-modal, etc.) to
  `useTranslations`/`getTranslations`. 42 JSON catalogs, all valid.
- Language switcher in `account-sidebar.jsx`: EN / *Bahasa Indonesia* buttons
  set the `locale` cookie via `document.cookie` + `router.refresh()`. Verified
  live: `/explore` and `/chart` serve EN by default and ID with `Cookie: locale=id`.
- Bumped version 1.7.56 → **1.8.0** (package.json, package-lock.json,
  next.config.mjs `NEXT_PUBLIC_APP_VERSION` env, public/sw.js `VERSION`, CLAUDE.md).
- Fixes: `money-flow/page.jsx` useEffect missing `t` dep; `use-chart-news.js`
  `set-state-in-effect` (moved `setNewsLoading(true)` into async IIFE); `src/app/explore/page.jsx` market tabs `t(cat.titleKey)` → `t(`explore.${cat.titleKey}`)` with root `useTranslations()`, CATEGORY_LABELS hardcoded labels → translated via `t("explore.category"+cap(category))`, manual Screener button labels `category.toUpperCase()` → `t("explore.screener"+cap(category))`, added keys categoryIdx/screenerIdx/screenerUs/screenerCrypto to both explore.json locales.
- Verification: 42/42 JSON valid; `npm run lint` 0 errors (1 pre-existing `<img>`
  warning); `npm run build` passes; `npm run test` 114/114; `next start` on :3000.

## Phase 14 — Finance route hardening + portfolio N+1

- `src/app/api/finance/route.js`: fixed null-deref where `quoteMeta.market`
  threw a TypeError when the best-effort `quote()` logo-metadata fetch failed
  (now `quoteMeta?.market`, graceful skip). Added best-effort DB cache
  (reuses `price_series_cache` with a `finance:<interval>:<start>:<end>`
  composite key, 60 s TTL) plus in-flight dedupe on the `chart()` call,
  mirroring the `/api/price-series` pattern. Any cache failure falls back to a
  live fetch so the API never breaks.
- `src/lib/api-client.js`: added shared `fetchBatchQuotes(symbols, timeframe?)`
  (single `POST /api/quotes` round-trip returning the full quotes map).
- `src/hooks/use-portfolio-data.js`: `refreshPrices` now calls
  `fetchBatchQuotes` instead of looping `fetchLatestQuote` per symbol —
  collapses N+1 `/api/finance` calls into one batched `/api/quotes` call.
  `fetchLatestQuote` kept (still used for the IDR=X/SGD=X FX pair and
  single-symbol add-asset lookups).
- `src/app/watchlist/page.jsx`: removed the local `fetchBatchQuotes`
  duplicate, imports the shared `fetchBatchQuotes` from `@/lib/api-client`.

**Validation**: lint 0/0, tests 113/113, build passes (27 routes + Proxy).
Docs updated: `docs/api.md`, `docs/ai-session-handoff.md`.

**Summary**: Executed all 7 phases of `docs/MAINTENANCE_PLAN.md` (synthesized
from `TECH_DEBT.md`, `UI_AUDIT.md`, `DOCS_DRIFT_REPORT.md`) in one session:
doc-drift corrections, `encodePayload()` safeguards, dead code deletion,
business-logic dedupe, motion/microinteraction polish, component-primitive
consolidation, and large-page decomposition. Architecture preserved — no new
paradigms introduced. `npm run lint` clean after every phase.

Subsequent phases: **Phase 8** (feature stabilization & UX) and **Phase 9**
(shadcn-first UI migration per `docs/SHADCN_MIGRATION.md` — sonner, Sheet,
Tooltip, SegmentedControl, cmdk Command, Tabs, Progress, Accordion, Badge,
DropdownMenuCheckboxItem). Both lint+build clean.

**Phase 10**: Removed the trial/pricing system — deleted `TrialProvider`,
`TrialGuard`, `TrialBanner`, and `src/app/pricing`; all routes now browsable
without auth (sign-in only gates write actions); fixed ESG `governanceEpochDate`
epoch-seconds bug in `chart/page.jsx` (now `* 1000`). Lint clean.

**Phase 10 Addendum**: Skeleton polish pass — added a `skeleton-stagger`
utility (CSS-only, `@layer utilities`) that rises blocks in with a 55 ms
staircase delay, applied across chart, explore, portfolio-tracker, msci,
money-flow, discussion, watchlist, and signin. `/chart` skeletons rebuilt to
mirror the loaded layout: header right side is now a single 48px avatar block
(matches `TickerAvatar`), left column mirrors price/change/market-state rows,
sidebar tabs now match the real 6-tab row (heights/widths, `hide-scrollbar`),
and the sidebar portfolio card is only shown while loading if
`hasPortfolioPosition`. Reduced-motion now also zeroes `animation-delay`.
Lint + build clean; server restarted on :3000.

**Phase 11 — Market data caching** (roadmap item, previously scoped-not-implemented):
new `src/lib/market-data-cache.js` — best-effort Supabase DB cache for
`/api/quotes` (TTL 60 s) and `/api/price-series` (60 s intraday, 15 min `D`,
1 h `W`, 6 h `M`). Reads serve fresh rows only, misses hit Yahoo, writes
upsert + prune stale rows past 7-day retention (deterministic cleanup, no
cron), and in-flight fetches are deduped per key. New tables
`quote_cache` / `price_series_cache` (`(symbol, timeframe)` PK, jsonb payload,
RLS public-select / service-role-write) in `supabase/setup.sql`. All failures
fall back to live fetch so caching never breaks the API; quotes meta now
reports `cached`/`fetched` counts. Docs updated (database, api, architecture,
folder-structure, state-management, roadmap).

**Phase 11 Addendum — free-tier efficiency + live polling**:
- `market-data-cache.js` now uses **signature-compare skip-write**: unchanged
  payloads only bump `cached_at` (tiny tuple update; the TOASTed jsonb blob is
  untouched) instead of rewriting — cuts MVCC write amplification from the 60 s
  poll cycle on the 500 MB free-tier DB. Retention lowered 7 → 3 days. Routes
  pass a `quoteSignature` / `seriesSignature`.
- **Live polling (60 s)**: watchlist refreshes quotes in place every minute
  (silent, no loading/flicker, paused when tab hidden); `use-chart-series.js`
  refactored to `loadSeries({ silent })` + intraday-only silent polling that
  updates the chart/header price without a loading state. Cadence matches the
  60 s cache TTL so every poll returns fresh data.

**Phase 12 — Testing infrastructure** (roadmap item):
- **Vitest** unit tests (`tests/unit/*.test.js`, 113 tests, 9 files) for lib
  business logic: utils, portfolio-metrics, secure-payload, msci-calculations,
  chart-helpers, money-flow, time, default-watchlist, stock-universe.
  Config `vitest.config.mjs` (node env, `@/` alias). Scripts `test` /
  `test:watch`. CI step `npm run test` added to the lint-and-build job.
- **Playwright** E2E smoke tests (`e2e/smoke.spec.mjs`) — app-shell render +
  mobile bottom-nav navigation + unauthenticated homepage redirect. Config
  `playwright.config.mjs` (chromium + mobile-chromium projects, auto-boots
  `next start` on :3100). Separate `e2e` CI job installs chromium with deps.
- **Bugs found by the new tests**: `formatMarketCap` emitted "450.0B"
  (now trims the trailing ".0"); `CRYPTO_TOP100_SYMBOLS` had 3 duplicate
  tickers (SOL-USD, USDC-USD, WETH-USD — removed second occurrences).
- Tests are offline/deterministic (no network/Supabase); Intl assertions
  normalized for ICU variance (nb-sp, currency glyphs).

**Phase 13 — Initial-JS reduction** (roadmap item, user-picked "kurangi JS awal"):
- Measured per-page initial JS (Playwright, fresh context, cold cache): `/explore`
  284 KB, `/watchlist` 278 KB, `/portfolio-tracker` 313 KB, `/chart` 450 KB
  (compressed). The earlier ~1.8 MB figure for `/watchlist` was **route
  prefetch** — Next auto-prefetches nav-link routes, pulling `/chart`'s heavy
  chunks (incl. 362 KB raw recharts) in the background on mobile first paint.
- recharts was the single biggest avoidable chunk and was only used by `/chart`
  (3 inline charts: earnings `ComposedChart` in the keystats tab, revenue
  `BarChart` in the keystats tab, seasonality `AreaChart` in the non-normal
  view). Extracted each into a lazy component (`src/components/recharts/
  earnings-chart.jsx`, `revenue-chart.jsx`, `seasonality-chart.jsx`) loaded via
  `next/dynamic` with `ssr: false` (matches the existing `PortfolioPie` pattern).
  All chart formatters stayed in `page.jsx` and are passed as props, so the
  diff is pure JSX substitution — no branch logic touched.
- Result: `/chart` initial script 450 KB → **340 KB** (-110 KB compressed);
  watchlist idle prefetch raw 1.8 MB → **1.4 MB** (recharts no longer
  prefetched). Earnings/revenue charts verified rendering via the lazy import
  (~5 s in, 2 `.recharts-responsive-container`, 4 `.recharts-surface`, no
  console/page errors). Lint 0, tests 113/113, e2e 5 pass, build OK, server
  restarted on :3000.
- **Prefetch=false pass**: `next/dynamic` only removed recharts from the
  critical path — App Router still auto-prefetches nav-link routes, so `/chart`
  route chunks (~360 KB raw) were still pulled in the background from lists.
  Added `prefetch={false}` to every list/nav link that targets `/chart`:
  `mobile-bottom-nav.jsx` (all 4 tabs), `ticker-row.jsx` (reused across
  watchlist/explore/msci/money-flow/rotation), `trending-marquee.jsx`,
  explore `PickerCard` + tool cards + market pulse strips. Result: mobile
  `/watchlist` idle background pull 1.36 MB → **950 KB** raw (17 scripts vs 27),
  `/explore` → 968 KB. Desktop navbar keeps prefetch for instant tab switching
  (desktop bandwidth); `not-found.jsx` link untouched. Lint 0, tests 113/113,
  e2e 5 pass, build OK, server restarted on :3000.

## Maintenance Plan — Files Modified

| Phase | File(s) | Change |
|---|---|---|
| 1 | `src/app/api/discussions/route.js` | Wrapped DELETE config-missing branch in `encodePayload()` |
| 1 | `docs/architecture-decisions.md`, `known-issues.md`, `database.md`, `conventions.md`, `state-management.md`, `coding-standards.md`, `tech-stack.md`, `dependencies.md`, `folder-structure.md` | Corrected stale architectural/version claims |
| 2 | `src/app/api/momentum/route.js`, `src/app/api/rotation/route.js` | Wrapped remaining error branches in `encodePayload()` |
| 3 | Deleted `src/components/ui/sidebar.jsx`, `radio-group.jsx`; deleted dead exports `isCryptoTicker`, `dayOfYearToMonthDate`, `sortByNearestInclusion`, `formatDecimalPercent` | Confirmed zero imports first |
| 4 | `src/app/api/msci/route.js`, `src/app/chart/page.jsx` | Wired up `calculateSummaryStats`; `formatPriceValue` replaced with `lib/utils.js#formatPrice`; `formatPlainNumber` kept as a thin wrapper (range-string passthrough from `formatRange()`) |
| 5 | `src/app/chart/page.jsx`, `src/app/msci/page.jsx`, `ticker-row.jsx`, `trending-marquee.jsx`, `explore/page.jsx`, `portfolio-tracker/page.jsx`, `watchlist/page.jsx`, `pricing/page.jsx`, `trial-banner.jsx`, `toast.jsx`, `ui/input.jsx`, `ui/select.jsx` | `scaleX` progress bars, `Button` back control, `DURATION_CLASS.base` timing, lucide `<X>` toast dismiss, dropped `box-shadow` from focus transitions |
| 6 | `add-asset-modal.jsx`, `portfolio-tracker/page.jsx`, `discussion/page.jsx`, `not-found.jsx`, `error.jsx`, `manage-watchlist-dialog.jsx` | Raw `<input>` → `<Input>`; extracted `MessageListSkeleton`; `<Button>`/`buttonVariants` CTAs; FLIP-animated watchlist drag-reorder |
| 7 | `src/app/chart/page.jsx` | Extracted `ChartMainSkeleton`/`ChartSidebarSkeleton`; promoted repeated `h-[260px]` to `SECONDARY_CHART_HEIGHT_CLASS` |
| 7 | `src/app/explore/page.jsx` | Extracted `MarketSymbolCard({ item, marketTimeframe })` |
| 7 | `src/app/portfolio-tracker/page.jsx` | Extracted `AddAssetForm` (state kept in parent, passed as props) |

## Maintenance Plan — Rescoped Items

- **Phase 4**: `formatPlainNumber` not fully replaced — `fiftyTwoWeekRange`/
  `dayRange` are pre-formatted range strings from `api/fundamentals/route.js`,
  not numbers; a full swap to `formatPrice()` would silently show the
  fallback dash.
- **Phase 5**: `chart/page.jsx`'s stacked recommendation-trend bar
  (segmented, each sibling's `width` sets flex-item layout size) left as
  `width` + `transition-all` — `scaleX` is visual-only and would collapse
  the segments.
- **Phase 6**: `global-error.jsx` kept hand-rolled — it replaces the entire
  root `<html>`/`<body>` and doesn't import `globals.css` itself, so neither
  `Button` nor the existing markup is guaranteed styled there.
- **Phase 7**: chart-page extraction target changed from the two
  originally-named ranges (already narrow, non-repeated) to the actual
  duplicated block — the loading skeletons. Spacing pass found only one
  genuine repeat (`h-[260px]` ×2); all other arbitrary `[Npx]` values in the
  file are true one-offs, left alone.

## Maintenance Plan — Validation

- `npm run lint`: clean after every phase (final: 0 errors / 0 warnings).
- Manual browser walk-through **not yet run** — recommended before this is
  considered fully done: chart fullscreen toggle, MSCI progress bar, toast
  dismiss, add-asset modal (both pages), discussion page load, watchlist
  manager drag-reorder (verify FLIP animation), not-found/error pages,
  explore market card grid.

## Maintenance Plan — Next Recommended Task

Manually verify the UI changes in-browser (list above), then decide on
`docs/MAINTENANCE_PLAN.md`'s Unresolved Question #1: whether native
Mac/iOS-feel work (spring-physics transitions, gesture navigation) needs its
own follow-up design-system phase — none of the 7 phases just completed add
that, they were maintenance/debt cleanup only.

---

## Phase 9 Record

**Summary**: Executed **Phase 9 — shadcn-first UI migration** per
`docs/SHADCN_MIGRATION.md` (P1–P4). Goal: shadcn/ui primitives as the primary
UI source across all pages, same layout template, zero visual regression.
Real audit coverage was ~40% shadcn before; after hard gaps closed. Several
audit-flagged "→ Card" conversions turned out to be no-ops (`card.jsx` is an
unstylized `flex flex-col` div — no border/bg/padding) and were skipped,
recorded in `SHADCN_MIGRATION.md`.

## Phase 9 Files Modified

| File | Change |
|---|---|
| `src/components/ui/{progress,sonner,tabs,command,dialog}.jsx` | Added via `npx shadcn@latest add`; `progress.jsx` extended with `indicatorClassName`; `dialog.jsx` regenerated to unified `radix-ui` imports |
| `package.json` / `package-lock.json` | `sonner@2`, `cmdk`, `radix-ui` deps added by shadcn CLI |
| `src/app/layout.jsx` | `<Toaster position="top-center" />` replaces `ToastViewport` (old position parity) |
| `src/components/toast.jsx` | **Deleted** — migrated to sonner |
| `add-asset-modal.jsx`, `discussion/page.jsx`, `explore/page.jsx`, `portfolio-tracker/page.jsx` | `toast()` import/`toast.error()`/`toast.success()` conversion (12 call sites) |
| `src/components/account-sidebar.jsx` | Hand-rolled `fixed` drawer → radix `Sheet` (`side="left"`); `onOpenChange` drives `onClose` |
| `src/app/chart/page.jsx` | `title` attrs → `Tooltip` (×3); info tabs → `Tabs variant="line"` (radix keyboard nav); quarter filter → `SegmentedControl`; 3 progress bars (governance/analyst/margin) → `Progress`; log-scale + Livermore toggles → `DropdownMenuCheckboxItem` |
| `src/components/market-bubbles.jsx` | Weekly/Monthly raw buttons → `SegmentedControl` |
| `src/components/header-symbol-search.jsx` | `<ul>` results + history chips → cmdk `Command` (`CommandGroup`/`CommandItem`/`CommandList`); `emptyState` memo removed |
| `src/components/add-asset-modal.jsx` | Search-result `<button>` rows → `Command` |
| `src/app/portfolio-tracker/page.jsx` | `<details>/<summary>` expanders ×2 → `Accordion`; inline `AddAssetForm` search → `Command` |
| `src/app/explore/page.jsx` | Screener status span → `Badge` |
| Docs | `SHADCN_MIGRATION.md` (audit + phase records), `ai-session-handoff.md` |

## Phase 9 Addendum (follow-up pass)

- **Chart info-tabs size fix**: `text-sm` from the `TabsTrigger` base beat custom `text-1xs` (tailwind-merge can't resolve non-standard theme utilities) → forced `text-[11px]`.
- **Tab content → `Table`**: Trading Snapshot, Upcoming Events, Financial Health info blocks converted from `<dl>` grids to shadcn `Table`.
- **`money-flow-card.jsx`**: `SignalBadge`/`RiskBadge` → `Badge` variants (`accumulation`/`highrisk` added to `ui/badge.jsx` cva); Gross/Net raw buttons → `SegmentedControl`.
- **`chart-trading-plan-panel.jsx`**: 3 raw `<label>` → `<Label>`.
- **`ticker-row.jsx`**: `NEW` pill → `Badge variant="new"`.
- Commits: `032115e` (P1–P4), `2bd6ca5` (tabs/table/money-flow round, P5).
- Validation: lint clean, build passes, dev smoke 200 on `/`, `/chart`, `/explore`, `/portfolio-tracker`, `/watchlist`, `/idx-bubbles`.

## Phase 9 Validation

- `npm run lint`: **0 errors / 0 warnings** after every file.
- `npm run build`: **passes** (27 routes + Proxy).
- Manual browser check not yet run — sonner toast positioning, Sheet swipe/close,
  `Tabs` underline on active info tab, cmdk keyboard nav in both search UIs,
  Accordion expand/collapse on portfolio tracker, Settings dropdown checkbox states.

## Phase 9 Skipped (with reasons)

| Item | Rationale |
|---|---|
| Banner / FX box / holding rows / price-target blocks → `Card` | `card.jsx` is an unstylized `<div class="flex flex-col gap-2">` — conversion adds zero classes, pure churn with regression risk |
| `<dl>` key-value grids → `Table` | Already semantic; Table wrapper = churn |
| Chart-type switcher → `DropdownMenuRadioGroup` | Radio dot ≠ existing emerald check; visual parity risk |
| Price-range bar → `Progress` | Absolute range + markers, not a single-value progress |
| `ui/chart.jsx` recharts wrapper adoption | chart page imports recharts directly; low visual value, churn risk on 2800-line page |
| MCP for shadcn | Not needed — `npx shadcn@latest add` covers everything; `components.json` `registries` block left empty |

## Phase 9 Next Recommended Task

Manual in-browser verification list above, then commit the phase (currently
uncommitted) under a single message referencing `SHADCN_MIGRATION.md`.

---

## Phase 8 Record

**Summary**: Executed **Phase 8 — Feature Stabilization & UX** (functional
bugs, UX polish, money-flow flag). Architecture preserved; no refactoring.
Caching (quotes + price-series only, DB cache, simple TTL, deterministic
cleanup) is **scoped but not yet implemented** — planned as a separate phase
after stabilization. Verified with `npm run lint` (0/0) and `npm run build`
(pass).

## Phase 8 Files Modified

| File | Change |
|---|---|
| `src/components/manage-watchlist-dialog.jsx` | Seed items on dialog open edge (was dead `onOpenChange(true)` logic); drag-to-reorder via Pointer Events (`GripVertical` handle, `touch-none`, keyboard `ArrowUp/Down` fallback) replacing arrow buttons |
| `src/app/watchlist/page.jsx` | Edit gated on `watchlistReady`; guest watchlist persisted to `localStorage` (`aruna_watchlist`) on save |
| `src/lib/default-watchlist.js` | `readStoredWatchlist()` / `writeStoredWatchlist()` helpers |
| `src/app/idx-bubbles/page.jsx` | Removed page-level duplicate back button |
| `src/components/market-bubbles.jsx` | Loading state now shows the back button (header lives entirely in `MarketBubbles`) |
| `src/app/explore/page.jsx` | `dark:hover:bg-*` added to active market/timeframe tabs; skeleton bottom section aligned to single-column layout; dead money-flow skeleton removed |
| `src/components/auth-provider.jsx` | `loading` held true on OAuth callback (`?code=`) until first session event (10 s fallback) |
| `src/components/trial-guard.jsx` | Waits on `auth.loading` before guest redirects |
| `src/app/account/page.jsx` | Redirects only after auth resolves; device-aware default (`/watchlist` mobile, `/explore` desktop) |
| `src/app/page.jsx` | Client device-aware first-load redirect (authenticated: mobile `/watchlist`, desktop `/explore`; guests `/explore`) |
| `src/app/chart/page.jsx` | Skeleton loading blocks aligned to final layout (left: header + chart + timeframe pills; right: portfolio card + Add button + tabs + panel) |
| `src/lib/tools-menu.js` | Money Flow entry gated on `NEXT_PUBLIC_MONEY_FLOW_ENABLED` |
| `src/app/money-flow/page.jsx` | Early-return placeholder when flag off; fetch skipped |
| `src/app/api/money-flow/route.js` | `404` when `MONEY_FLOW_ENABLED=false` |
| `src/app/api/cron/money-flow/route.js` | No-op `200 { status: "disabled" }` when flag off (no truncation) |
| `src/app/manifest.json/route.js` | Money Flow shortcut gated on `NEXT_PUBLIC_MONEY_FLOW_ENABLED` |
| `.env.template` | Added `MONEY_FLOW_ENABLED` / `NEXT_PUBLIC_MONEY_FLOW_ENABLED` |
| Docs | `environment.md`, `api.md`, `known-issues.md`, `ai-session-handoff.md` |

## Phase 8 Validation Results

- `npm run lint`: **0 errors / 0 warnings**.
- `npm run build`: **passes** — 27 routes + `ƒ Proxy (Middleware)`.
- Manual checks not yet run in browser: watchlist edit/reorder/guest-persistence,
  OAuth callback landing, first-load device routing, /idx-bubbles back button,
  dark-mode tab hover, chart skeleton fidelity, money-flow flag on/off.

## Phase 8 Product Decisions

- **Caching deferred to a separate phase**, scoped to `/api/quotes` +
  `/api/price-series` only (no finance/fundamentals/symbol-search), DB cache
  table, simple TTL, deterministic cleanup, no edge cache until real usage
  justifies it.
- **Money Flow disabled via env flags** (default on), not code removal —
  re-enabling is an env flip.

---

## Phase 7 Record

**Summary**: Executed **Phase 7 — Production Hardening & Release Readiness**
per the approved assessment (docs/PHASE_EXECUTION_PLAN.md + assessment).
Architecture preserved; no refactoring. All changes verified with
`npm run lint` (0/0) and `npm run build` (pass, 27 routes, proxy warning gone).

Product decisions recorded this phase:
- **Cron scheduling: disabled** (Hobby 2/day limit considered). `vercel.json`
  stays `{}`. Manual-trigger is the documented behavior. See
  `docs/deployment.md`.
- **Screener access: public + minimal per-IP rate limit** (20/min) in
  `src/proxy.js`. No token-bucket; fixed-window counter, cron UA exempt.
- **Observability: no external platform.** Structured JSON logs only.

## Files Created

| File | Purpose |
|---|---|
| `src/app/error.jsx` | Client error boundary (in-app retry) |
| `src/app/global-error.jsx` | Root-layout fallback boundary |
| `src/components/toast.jsx` | Dependency-free toast (`toast()` + `ToastViewport`), mounted in root layout |
| `src/app/api/health/route.js` | Lightweight liveness probe (plain JSON) |
| `.github/workflows/ci.yml` | lint + build on push/PR with placeholder envs |
| `src/proxy.js` | Replaces `middleware.js` (Next 16 proxy convention) + screener rate limiter |

## Files Modified

| File | Change |
|---|---|
| `next.config.mjs` | Security `headers()`: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS, report-only CSP |
| `src/lib/yahoo-finance.js` | 20s `AbortSignal.timeout` + structured request log (source/status/duration) |
| `src/app/api/cron/[category]/route.js` | Base-URL validation (500 if unset), 55s timeout, structured success/error logs |
| `src/app/api/cron/money-flow/route.js` | Truncate-after-success (was truncate-before-fetch), 20s timeouts per fetch, summary log |
| `src/app/api/discussions/route.js` | All error responses now `payload: encodePayload({ error })` |
| `src/lib/api-client.js` | `fetchEncodedJson(url, init, timeoutMs?)` — 30s default timeout; non-encoded `{ error }` bodies throw the real message |
| `src/hooks/use-chart-data.js` + `chart/page.jsx` | Fetch failure → `error` state + "Try Again" card (replaces `alert()`) |
| 5 alert() call sites | `add-asset-modal`, `discussion`, `portfolio-tracker` (×6), `explore` (×2) → `toast()` |
| `src/app/layout.jsx` | `<ToastViewport />` mounted |
| `src/app/chart/page.jsx` | `trump.gif` img `loading="lazy"` |
| `public/sw.js` | `VERSION` → `1.7.56` (aligned to package.json); `/explore` added to APP_SHELL |
| `public/` | Removed 9 dead assets (mockup PNGs + starter SVGs) |
| `.env` | Removed dead `AI_GATEWAY_URL/KEY`, `AI_MODEL`; deleted empty `src/lib/ai/` |
| Docs | `deployment.md` (cron decision, health, CI, headers), `api.md` (health, rate limit, client timeout), `known-issues.md` (resolutions + new items), `roadmap.md`, `environment.md`, `authentication.md`, `architecture.md`, `application-flow.md`, `folder-structure.md`, `architecture-decisions.md`, `MAINTENANCE_PLAN.md` (P7 resolved), `DOCS_DRIFT_REPORT.md` (archived), `CLAUDE.md`, `README.md`, `ai-session-handoff.md` |

## Validation Results

- `npm run lint`: **0 errors / 0 warnings**.
- `npm run build`: **passes, 0 warnings** — 27 routes; `ƒ Proxy (Middleware)`
  confirms the rename; the `middleware`-deprecation warning is gone.
- Live smoke test (`npm start`, production build):
  - `/api/health` → `{"status":"ok","timestamp":...}`.
  - Page response carries all 6 security headers (incl. CSP report-only).
  - Screener limiter: 20× `400`, then `429` + `Retry-After: 60`;
    `/api/health` unaffected; `User-Agent: aruna-cron` exempt.
- Rate-limiter logic verified via cheap invalid-category path
  (`/api/screeners/foo` = instant 400) — no real Yahoo batches triggered.

## Items Skipped / Deferred

| Item | Rationale |
|---|---|
| Root `loading.jsx` | Existing per-feature skeletons + shell gating already cover loading; a generic shell would double-render. |
| `trump.gif` re-encode (3.1MB) | No ffmpeg/gifsicle/ImageMagick in environment; `loading="lazy"` added instead. Documented in known-issues. |
| Strict CSP | Report-only first; Next/Tailwind inline styles need a production report audit before enforcing. |
| Full API rate limiting | Only `/api/screeners` limited this phase (product decision). |
| Sentry/external monitoring | Explicitly out of scope per Phase 7 constraints. |
| Client retry logic | Timeout added; auto-retry deferred (users have Try Again / pull-to-refresh). |

## Blockers for Next Phase

- None. Phase 7 scope complete.

## Next Recommended Task

Release to production: deploy, then walk the manual verification checklist in
the Phase 7 assessment (error boundary on bad symbol, 429 behavior, health
probe, PWA offline cold-launch to `/explore`, sw.js update flow). Then retire
the remaining Known Issues (live FX rate, full rate limiting,
external monitoring) as prioritized in `docs/roadmap.md`.

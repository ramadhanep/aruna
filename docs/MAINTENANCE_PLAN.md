# Maintenance Plan

Execution plan synthesized from `docs/TECH_DEBT.md`, `docs/UI_AUDIT.md`, and
the cron investigation: cron route handlers remain functional, but the
`vercel.json` cron schedule was accidentally removed. Restoring a schedule is
an explicit product/deployment decision, not an assumed code change.

The plan is ordered to establish safe patterns and shared seams before the two
large route decompositions. Each phase is independently reviewable and should
finish with `npm run lint`; build and device checks are added where the change
affects route rendering or PWA chrome.

## Phase 0 — Quick wins and mobile ergonomics

**Goal:** Remove clearly obsolete code, establish shared small constants and
formatters, and fix the safe-area/touch-target problems with no architectural
dependency.

**Scope:** TD-5, TD-6, TD-10, TD-11, UI-3, UI-4, UI-6.

**Files touched:**

- `src/lib/utils.js`; a small shared constants/date-range module if warranted;
  `src/hooks/use-mobile.js`.
- Consumers of duplicated formatters/constants: `money-flow-card.jsx`,
  `money-flow/page.jsx`, `idx-momentum/page.jsx`, `explore/page.jsx`,
  `portfolio-tracker/page.jsx`, `add-asset-modal.jsx`, and `trial-banner.jsx`.
- Dead/obsolete code: `src/components/market-canvas.jsx`,
  `src/components/desktop-sidebar.jsx`, `money-flow/page.jsx`,
  `portfolio-tracker/page.jsx`, and `account-sidebar.jsx`.
- PWA chrome: `src/app/globals.css`, `src/components/mobile-bottom-nav.jsx`,
  `src/components/app-layout-client.jsx`, `src/app/idx-rotation/page.jsx`, and
  `src/components/market-bubbles.jsx`.

**Dependencies:** None. Confirm that apparently unused components have no
dynamic/external consumer before deleting them.

**Effort:** M (a set of small, independently shippable changes).

**Definition of done:**

- [x] `MarketCanvas` and `DesktopSidebar` — files were already deleted.
      Documentation references removed.
- [x] Commented-out feature implementations — inspection confirmed no
      `{/* ... */}` commented-out JSX blocks remain in the 3 target files.
      Only explanatory label comments exist. TD-11 resolved.
- [x] Shared formatters — `formatDecimalPercent`, `formatUSD`, `formatIDR`,
      `formatSGD`, `formatByCurrency` added to `src/lib/utils.js`. Local
      duplicates removed from `money-flow/page.jsx` (both were uncalled).
      `portfolio-tracker/page.jsx` currency formatters replaced with imports.
      `formatValue` (state-coupled) retained locally with `ponytail:` rationale.
- [x] The 1024px mobile threshold and shared request-window values — already
      centralized in `src/lib/time.js`. No duplicate literals found.
- [x] Mobile bottom navigation and main-content clearance — already applied
      via `.bottom-safe`, `.pt-safe`, `.pb-nav-safe` classes. `viewportFit:
      'cover'` already present in `layout.jsx` viewport metadata.
- [x] Back/download controls — already 44px (`h-11 w-11`) in `idx-rotation`
      and `market-bubbles`. Timeframe toggle buttons in `market-bubbles.jsx`
      updated with `min-h-11`.
- [x] `npm run lint` — no new findings (same 27 errors / 10 warnings as
      pre-existing baseline, all Phase 1 items). Build passes.

**Documentation after implementation:** Update `docs/conventions.md` for any
new shared constants/local conventions, `docs/ui-architecture.md` for
safe-area and touch-target rules, `docs/folder-structure.md` if files are
added/removed, and `docs/ai-session-handoff.md`. Update
`docs/architecture.md` only if a new cross-cutting lib module changes the
documented layer map.

## Phase 1 — Establish compliant React effect and render patterns

**Goal:** Clear the existing React lint failures and stabilize market-bubble
rendering before extracting code, so later modules do not inherit unsafe state
or purity patterns.

**Scope:** TD-7 and TD-8; address all current `set-state-in-effect`, ref-read,
render-purity and hook-dependency findings that are in scope of the audit.

**Files touched:** At minimum `src/app/explore/page.jsx`,
`watchlist/page.jsx`, `portfolio-tracker/page.jsx`, `discussion/page.jsx`,
`chart/page.jsx`; `src/components/auth-provider.jsx`,
`header-symbol-search.jsx`, `manage-watchlist-dialog.jsx`,
`add-asset-modal.jsx`, `market-bubbles.jsx`, `mode-toggle.jsx`,
`account-sidebar.jsx`, `trial-provider.jsx`; and `src/hooks/use-mobile.js`.
Any extracted hook belongs in `src/hooks/` and pure calculation belongs in
`src/lib/`.

**Dependencies:** Phase 0 is preferred for its shared breakpoint/date helpers,
but not technically blocking. This phase blocks Phases 2 and 3.

**Effort:** M.

**Definition of done:**

- [x] `npm run lint` passes with **0 errors, 8 warnings** — all remaining
      warnings are `@next/next/no-img-element` (8 instances, pre-existing,
      deferred to Phase 6 `no-img-element` audit).
- [x] Effects synchronize with external systems/subscriptions rather than
      copying derived values into state; async work handles unmount/stale
      results safely.
- [x] Bubble positions and animation metadata are stable by symbol and no
      render path reads mutable refs or calls `Math.random()`.
- [x] Auth, trial, watchlist, explore, portfolio and dialog behaviour is smoke
      tested across initial load, sign-in/out, and route changes.

**Documentation after implementation:** Update `docs/coding-standards.md` and
`docs/conventions.md` with the approved data-loading/effect pattern;
`docs/state-management.md` if state ownership changes; and
`docs/ai-session-handoff.md`. Update `docs/architecture.md` and
`docs/folder-structure.md` if new hooks/lib modules are introduced.

## Phase 2 — Decompose the chart route around clear feature boundaries

**Goal:** Turn `src/app/chart/page.jsx` from a 4,700-line feature subsystem
into route composition, focused feature components, hooks, and pure lib
helpers without changing product behaviour.

**Scope:** TD-1, with the chart portion of UI-8 and UI-9.

**Files touched:** `src/app/chart/page.jsx`; new chart components under
`src/components/` (or a focused chart feature directory consistent with the
folder convention); hooks under `src/hooks/`; pure seasonal/trading-plan/date
helpers under `src/lib/`; and only the existing chart-related UI primitives as
needed.

**Dependencies:** Requires Phase 1. It has an interface dependency on Phase 4:
chart extraction must isolate logo cache/provider configuration and symbol/price
requests behind narrow helpers so Phase 4 can consolidate them without another
route-wide rewrite. Do not create additional route-local provider constants in
this phase.

**Effort:** L.

**Definition of done:**

- [x] The route owns URL/search-param handling and feature composition only;
      pure calculations and browser persistence/fetch state have named homes.
- [x] Chart panels, trading plan, fundamentals, seasonal views and dialogs are
      independently readable components with explicit props.
- [x] Reusable logic has no dependency on pages/components; components never
      import API route modules and use `fetchEncodedJson()` through approved
      helpers.
- [x] Existing chart states—normal/seasonal modes, symbol change, watchlist,
      portfolio action, dialog and error/loading paths—are smoke tested.
- [x] Lint and production build pass; no regressions in Suspense wrapping for
      `useSearchParams`.

**Documentation after implementation:** Update `docs/architecture.md`,
`docs/folder-structure.md`, `docs/conventions.md`, `docs/state-management.md`,
and `docs/ui-architecture.md` where component ownership or chart layout
changes. Update `docs/ai-session-handoff.md`.

## Phase 3 — Decompose portfolio state and resolve its persistence contract

**Goal:** Separate portfolio page composition, domain calculations, storage,
remote data, form/search state, and visual sections while preserving existing
user data.

**Scope:** TD-2 and the portfolio portion of UI-8/UI-9. TD-9 storage
strategy is already approved (Option B — one-time migration to canonical
`aruna-portfolio`).

**Files touched:** `src/app/portfolio-tracker/page.jsx`,
`src/app/portfolio-tracker/pie.jsx`, `src/components/add-asset-modal.jsx`;
new portfolio hooks/components/lib modules; and, only after an approved
migration decision, portfolio storage declarations and tests/manual fixtures.

**Dependencies:** Requires Phase 1. Coordinate its request boundaries with
Phase 4. The local-storage decision below must be approved before changing
keys or stored shapes.

**Effort:** L.

**Approved TD-9 decision:** Option B — one-time migration to canonical
`aruna-portfolio`. On first portfolio load, read legacy keys
(`portfolio_currency`, `portfolio_visibility_hidden`, `aruna_guest_portfolio`,
`aruna_guest_portfolio_seeded`), convert to canonical schema, and persist as
`aruna-portfolio`. All subsequent reads/writes use the canonical record only.
No dual-write or permanent compatibility layer. `ClearDataButton` must remove
both the canonical record and all known legacy keys. See
`docs/PHASE_EXECUTION_PLAN.md` for full policy.

**Definition of done:**

- [ ] Page composition is separate from portfolio calculations, persistence,
      FX/quote loading, pull-to-refresh, asset search and edit-form state.
- [ ] The selected storage strategy is recorded, preserves existing user data,
      and covers malformed/legacy local-storage values.
- [ ] Guest, authenticated, remote-sync, currency, hidden-balance, add/edit/
      delete asset, and chart-loading paths are smoke tested.
- [ ] Portfolio-specific dimensions/text styles are shared where recurrent,
      without prematurely redesigning the full visual system.
- [ ] Lint and production build pass.

**Documentation after implementation:** Update `docs/conventions.md` and
`docs/state-management.md` for the settled storage contract;
`docs/folder-structure.md`, `docs/architecture.md`, and
`docs/ui-architecture.md` for extraction/layout changes; and
`docs/ai-session-handoff.md`. If persistence shape changes, also update the
relevant portfolio description in `README.md`/`docs/application-flow.md`.

## Phase 4 — Consolidate shared data access and provider configuration

**Goal:** Make server logo caching, client symbol/price requests, provider
configuration and market catalog ownership single-source after the large pages
have clean seams.

**Scope:** TD-3, TD-4 and TD-12.

**Files touched:** `src/app/api/quotes/route.js`, `api/finance/route.js`,
`src/components/add-asset-modal.jsx`, portfolio/chart consumers, and
`src/app/explore/page.jsx`; new server-safe helpers and client helpers in
`src/lib/` (and hooks only where React lifecycle is needed); `.env.template`
only if a newly variable deployment setting is approved.

**Dependencies:** Phases 2 and 3 provide the clean consumers; Phase 0 may
already provide shared range constants. Avoid moving secrets into client code
and preserve XOR response envelopes/API routes.

**Effort:** M.

**Definition of done:**

- [ ] `ensureUsLogo()` has one server-only implementation shared by quotes and
      finance routes, with preserved caching/error behaviour.
- [ ] Symbol search and latest-price access have one client-facing helper using
      `fetchEncodedJson()`; no duplicate decoder/error/date-window wrappers
      remain in UI files.
- [ ] CDN/storage/provider bases and static market catalog data reside in the
      appropriate config/lib module; values that vary by deployment are env
      configuration, not duplicated literals.
- [ ] No API route response encoding, authorization, or public response shape
      changes without an explicit compatibility decision.
- [ ] Lint, build, and representative quote/finance/symbol-search requests
      pass.

**Documentation after implementation:** Update `docs/architecture.md`,
`docs/folder-structure.md`, `docs/api.md`, and `docs/integrations.md`.
Update `docs/environment.md` and `.env.template` if env variables are added;
update `docs/ai-session-handoff.md` in all cases.

## Phase 5 — Apply a coherent UI polish system

**Goal:** Replace remaining disruptive spinners, make motion consistent, and
bring navigation, spacing and color use back to the documented visual system.

**Scope:** UI-1, UI-5, UI-7, UI-9, UI-10 and UI-11. UI-2 may be included when
its affected components are touched, but should not block the phase.

**Files touched:** `src/components/market-bubbles.jsx`,
`src/app/idx-rotation/page.jsx`, `src/app/discussion/page.jsx`,
`src/app/chart/page.jsx`, `src/app/portfolio-tracker/page.jsx`,
`src/components/mobile-bottom-nav.jsx`, `desktop-navbar.jsx`,
`account-sidebar.jsx`, `src/lib/motion.js`, `src/app/globals.css`, plus focused
loading/feature components extracted in Phases 2-3.

**Dependencies:** Phases 0-3. Use Phase 2/3 component boundaries rather than
editing large page sections inline. Phase 6 may take any component extraction
that this visual work exposes but is not required to begin polish.

**Effort:** L.

**Definition of done:**

- [ ] Bubble, rotation, discussion, normal-chart and portfolio-mini-chart
      initial states reserve final layout with skeleton/shimmer rather than
      whole-screen/centered spinners.
- [ ] `motion.js` is the approved timing policy for custom surfaces; navigation,
      tabs/data replacement and sidebars use consistent durations/eases without
      double-animating Radix primitives.
- [ ] Bottom navigation is responsive through the documented mobile/tablet
      range, visually consistent with Aruna’s restrained navigation, and has
      usable labels/captions where needed.
- [ ] Repeated chart/nav/mini-chart dimensions and small typography are
      tokenized or component variants; unjustified arbitrary values are gone.
- [ ] Analyst/rotation/dropdown color and elevation treatments preserve only
      useful semantic signal and follow the monochrome-plus-sparing-blue system.
- [ ] Dark/light, mobile/tablet/desktop, reduced-motion, and installed-PWA
      smoke checks pass; lint and build pass.

**Documentation after implementation:** Update `docs/ui-architecture.md` for
loading, motion, responsive navigation, spacing and color rules;
`docs/conventions.md` for shared class/variant conventions;
`docs/folder-structure.md` if components move; and
`docs/ai-session-handoff.md`.

## Phase 6 — Complete componentization and eliminate remaining class sprawl

**Goal:** Finish the extraction work intentionally deferred from Phases 2, 3
and 5, especially repeated presentation patterns in explore/portfolio/chart.

**Scope:** Remaining TD-2/UI-8 work, including reusable feature cards,
segmented controls, status chips, metric rows and loading/empty states.

**Files touched:** Remaining large page sections in `src/app/chart/page.jsx`,
`portfolio-tracker/page.jsx`, and `explore/page.jsx`; new focused components
under `src/components/`; potentially `src/components/ui/` only for a genuinely
cross-feature primitive using `cn()`/cva.

**Dependencies:** Requires Phases 2, 3 and 5. Do not create a generic
abstraction for a single chart’s one-off markup.

**Effort:** L.

**Definition of done:**

- [ ] Feature pages are primarily composition and state wiring; recurring
      presentation is in readable components with explicit props.
- [ ] Repeated Tailwind strings have named component/cva variants where the
      visual behaviour is genuinely shared.
- [ ] UI primitives retain their shadcn-compatible boundary and depend only on
      `@/lib/utils`; no new UI framework/state library is introduced.
- [ ] Visual regression smoke tests cover all extracted states; lint and build
      pass.

**Documentation after implementation:** Update `docs/architecture.md`,
`docs/folder-structure.md`, `docs/ui-architecture.md`, and
`docs/conventions.md`; update `docs/ai-session-handoff.md`.

## Phase 7 — Decide and restore/document cron scheduling

**Goal:** Resolve the independent deployment gap: API cron route handlers are
functional, but `vercel.json` currently has no cron configuration because it
was accidentally dropped.

**Scope:** Restore an approved schedule, or formally document cron scheduling
as intentionally disabled. The likely work includes IDX/US daily runs and an
explicit review of crypto/money-flow frequency against Vercel Hobby tier limits.

**Files touched:** `vercel.json`; potentially cron route/config helpers only if
the approved schedule exposes a real operational constraint; deployment and
cron documentation. No route handler rewrite is implied by the investigation.

**Dependencies:** Independent of Phases 0-6, but requires a product/deployment
decision and access to the current Vercel plan/limits. It must not be silently
restored with guessed frequency.

**Effort:** S for a documented decision or restoring known-safe schedules; M if
frequency/batching needs redesign after plan-limit evaluation.

**Decision required:**

1. Restore IDX and US daily schedules, then choose crypto/money-flow cadence
   compatible with the Hobby tier; or
2. formally mark scheduled refresh as disabled and describe the stale-data/
   manual-trigger behaviour users should expect.

**Definition of done:**

- [ ] The selected option, exact UTC schedules, ownership, and Vercel plan
      constraints are approved and recorded.
- [ ] If enabled, `vercel.json` lists the approved cron entries and each route
      is manually invoked with `CRON_SECRET` in a safe environment.
- [ ] If disabled, no documentation claims automatic refresh; operational and
      product consequences are recorded.
- [ ] Database writes, authorization failures, duration, and schedule overlap
      are observed for at least one run per enabled category.

**Documentation after implementation:** Update `docs/deployment.md`,
`docs/application-flow.md`, `docs/api.md`, `docs/known-issues.md`, and
`docs/roadmap.md`; update `docs/architecture.md` if the scheduled data-flow
description changes, and always update `docs/ai-session-handoff.md`.

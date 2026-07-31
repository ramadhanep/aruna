# Phase Execution Plan

This is a preparation-only runbook for `docs/MAINTENANCE_PLAN.md`. It does not
authorize implementation. Estimates refer to the work in a phase, excluding
product-review waiting time.

## Program dependency graph

```text
P0 Quick wins ──> P1 Effect/purity baseline ──> ┬─> P2 Chart decomposition ─────┐
                                                  │                                ├─> P4 Shared access ─> P5 UI polish ─> P6 Componentization
                                                  └─> P3 Portfolio decomposition ──┘

P7 Cron decision/restoration (independent; external decision gate)
```

`P2` and `P3` may proceed in parallel after `P1`, provided they do not modify
shared data-access modules. `P4` is intentionally after both, so it can use the
extracted boundaries rather than force a second route-wide rewrite.

## Program-wide controls

- Create a baseline branch/commit before Phase 0 and record the current lint
  result (27 errors, 11 warnings from the audit).
- Run `npm run lint` after every atomic task that changes JS/JSX, and before
  every commit. Run `npm run build` at each phase boundary and before merging
  any route decomposition.
- Use a real Supabase test account and a disposable browser profile for
  local-storage, auth and remote-sync checks. Never use a normal user profile
  to test destructive clear-data behaviour.
- Keep API response envelopes and endpoint URLs stable unless a separately
  approved compatibility change explicitly updates `aruna-api.json` and
  `docs/api.md`.
- For UI work, verify dark and light modes at 375px, 768px, 1024px and desktop;
  separately test an iOS/standalone-PWA safe-area viewport and reduced motion.
- Each phase owns its documentation updates; do not defer all documentation to
  a final sweep.

## Phase 0 — Quick wins and mobile ergonomics

**Execution order and atomic tasks**

1. Re-run reference searches for `MarketCanvas` and `DesktopSidebar`, including
   dynamic import/string searches; decide delete versus retain before editing.
2. Delete confirmed dead modules in an isolated change.
3. Delete obsolete commented-out UI blocks after checking Git history/issue
   context; do not delete an active `eslint-disable` explanation.
4. Inventory each duplicated formatter’s output for zero, null, negative and
   locale values; define one approved helper contract in `src/lib/utils.js`.
5. Migrate formatter consumers one at a time and verify unchanged display.
6. Define/export the single mobile breakpoint and short finance date-window
   helper; replace duplicate literals.
7. Add safe-area-aware nav/content/full-screen tool layout rules.
8. Increase tool-header interactive hit areas to 44px while preserving icon
   size and visual density.
9. Perform viewport/PWA checks, then update documentation.

**Estimated files touched**

- Delete: `src/components/market-canvas.jsx`,
  `src/components/desktop-sidebar.jsx` (only after task 1).
- Cleanup: `src/app/money-flow/page.jsx`,
  `src/app/portfolio-tracker/page.jsx`, `src/components/account-sidebar.jsx`.
- Shared helpers: `src/lib/utils.js`; likely `src/lib/*constants*.js` or
  `src/hooks/use-mobile.js`.
- Formatter/date/breakpoint consumers: `money-flow-card.jsx`,
  `money-flow/page.jsx`, `idx-momentum/page.jsx`, `explore/page.jsx`,
  `portfolio-tracker/page.jsx`, `add-asset-modal.jsx`, `trial-banner.jsx`.
- PWA UI: `src/app/globals.css`, `src/components/mobile-bottom-nav.jsx`,
  `src/components/app-layout-client.jsx`, `src/app/idx-rotation/page.jsx`,
  `src/components/market-bubbles.jsx`.

**Rollback risk:** Low. Module removal is fully reversible in Git; safe-area
CSS can affect fixed-position overlap, so revert that commit independently if
it introduces clipping. Formatter consolidation has medium display-regression
risk; keep it separate from deletion and layout changes.

**Testing checklist**

- [ ] Formatter snapshots/manual matrix: null, zero, positive, negative, large
      number and existing precision-sensitive value.
- [ ] At 375px and 768px, last content row remains reachable above bottom nav.
- [ ] At a 1024px boundary, the intended desktop/mobile chrome changes exactly
      once with no gap/overlap.
- [ ] In standalone/notched viewport, top tool actions and bottom nav are fully
      tappable; back/download targets measure at least 44×44 CSS px.
- [ ] Existing full-screen bubble and rotation interactions still work.

**Checkpoints:** `npm run lint` after tasks 2, 5, 6 and 8; `npm run build` and
the UI smoke checklist after task 9.

**Documentation checklist**

- [ ] `docs/conventions.md`: shared formatter/constant conventions.
- [ ] `docs/ui-architecture.md`: safe-area and 44px mobile-control guidance.
- [ ] `docs/folder-structure.md`: only if modules are added/deleted.
- [ ] `docs/architecture.md`: only if a cross-cutting lib module is introduced.
- [ ] `docs/ai-session-handoff.md`: work completed, validation, follow-up.

**Recommended commits**

1. `chore: remove confirmed dead UI modules and stale commented blocks`
2. `refactor: centralize display formatters and responsive constants`
3. `fix: make mobile PWA chrome safe-area and touch-target aware`

## Phase 1 — Effect-pattern and render-purity baseline

**Execution order and atomic tasks**

1. Capture exact lint output by file/rule and classify each issue: derived
   state, external subscription, async fetch, mount-only hydration guard, or
   render impurity.
2. Establish the approved patterns in a small, reviewed implementation note:
   derived values computed in render; event handlers for user mutations;
   subscriptions/effects with cleanup and cancellation for external work.
3. Fix independent component-level cases first: `use-mobile`, mode toggle,
   account sidebar, header search, manage-watchlist dialog, add-asset modal,
   trial provider.
4. Fix context lifecycle (`auth-provider`) and verify sign-in/sign-out/sync.
5. Fix page fetch/effect cases in discussion, watchlist, explore, portfolio and
   chart; do not combine this with their upcoming visual decompositions.
6. Make bubble animation metadata deterministic and remove render-time ref
   reads/`Math.random()`.
7. Resolve remaining dependency/memoization warnings or document a narrowly
   justified exception.

**Estimated files touched**

`src/hooks/use-mobile.js`; `src/components/{auth-provider,header-symbol-search,
manage-watchlist-dialog,add-asset-modal,market-bubbles,mode-toggle,
account-sidebar,trial-provider}.jsx`; and `src/app/{explore,watchlist,
portfolio-tracker,discussion,chart}/page.jsx`. New focused hooks may be added
under `src/hooks/`; pure helper modules may be added under `src/lib/`.

**Rollback risk:** Medium. State timing, auth hydration, polling, and async
request cancellation can alter visible loading or persistence behaviour. Commit
each behavioural area independently; do not use broad lint suppression as a
rollback substitute.

**Testing checklist**

- [ ] Cold load and resize validate the mobile breakpoint without hydration
      flicker.
- [ ] Symbol search debounce, cancel/close, no-query state and error state.
- [ ] Sign-in, sign-out, remote watchlist/portfolio refresh and trial expiry.
- [ ] Discussion initial load and 10-second polling do not double-fetch or
      update after navigation.
- [ ] Watchlist/explore refresh and tab/timeframe changes reject stale results.
- [ ] Bubble positions/animation remain stable through unrelated parent renders
      and resize; drag/download behaviour continues to work.

**Checkpoints:** lint after each task group (3–6); require zero lint errors
before beginning P2/P3; build plus the full testing checklist at phase close.

**Documentation checklist**

- [ ] `docs/coding-standards.md` and `docs/conventions.md`: approved effect,
      cancellation and derived-state patterns.
- [ ] `docs/state-management.md`: if ownership or lifecycle changes.
- [ ] `docs/architecture.md` / `docs/folder-structure.md`: if hooks/helpers are
      created.
- [ ] `docs/ai-session-handoff.md`.

**Recommended commits**

1. `fix: normalize component hydration and derived-state effects`
2. `fix: stabilize auth and page data-fetch lifecycles`
3. `fix: make market bubble rendering deterministic`
4. `docs: document approved React effect patterns`

## Phase 2 — Chart page decomposition

**Execution order and atomic tasks**

1. Freeze the chart’s public behaviour with a route/state matrix: query params,
   normal/seasonal view, symbol, timeframe, tabs, chart display type, dialogs,
   watchlist and portfolio action.
2. Mark every top-level function in `chart/page.jsx` as pure lib helper, hook,
   presentational component, or route-only URL composition.
3. Extract pure seasonal/trading-plan/date/formatting helpers first; unit-test
   or table-test outputs before replacing call sites.
4. Extract isolated visual components (gauge, summary panels, heatmaps,
   fundamentals sections) with explicit data/callback props.
5. Extract browser persistence and API orchestration into focused hooks, using
   only narrow `fetchEncodedJson`-based helpers—not provider-specific logic.
6. Reduce `page.jsx` to Suspense/URL state, hook composition and feature layout.
7. Restore/verify every matrix state, then perform a full review for unwanted
   server/client boundary changes.

**Estimated files touched**

`src/app/chart/page.jsx`; new `src/components/chart-*` files or a focused
chart feature directory; new `src/hooks/use-chart-*.js`; new `src/lib/chart-*.js`
and possibly additions to `seasonalData.js`; related existing components
(`normal-candlestick-chart.jsx`, `add-asset-modal.jsx`, header search) only at
their interface boundary.

**Rollback risk:** High. Extraction can alter data-fetch timing, URL-state
sync, client/server boundaries and props. Maintain compatibility adapters until
the route matrix passes; make one functional slice per commit.

**Testing checklist**

- [ ] Direct URLs for `symbol`, `cycle`, and `tab` work on hard refresh.
- [ ] `useSearchParams` remains inside an appropriate Suspense boundary.
- [ ] Symbol change cancels/ignores stale requests and updates local history.
- [ ] Normal candle/line/Heikin-Ashi, full-screen chart, fundamentals,
      seasonality, trading-plan and portfolio dialog paths match baseline.
- [ ] Logged-in/guest watchlist and portfolio actions retain local-first sync.
- [ ] No extracted lib module imports from `src/app` or `src/components`.

**Checkpoints:** lint after every extraction slice; build after helper and hook
extraction, and again at phase close. Run the chart matrix after each UI slice.

**Documentation checklist**

- [ ] `docs/architecture.md`, `docs/folder-structure.md`,
      `docs/conventions.md`, `docs/state-management.md`.
- [ ] `docs/ui-architecture.md` only if rendered composition/layout changes.
- [ ] `docs/ai-session-handoff.md`.

**Recommended commits**

1. `refactor(chart): extract pure seasonal and trading-plan helpers`
2. `refactor(chart): extract chart data and persistence hooks`
3. `refactor(chart): extract feature panels and simplify route composition`
4. `docs: record chart feature boundaries`

## Phase 3 — Portfolio decomposition and persistence decision

**Execution order and atomic tasks**

1. Create a browser-fixture matrix for no storage, malformed JSON, each legacy
   key combination, guest portfolio, authenticated portfolio and remote
   overwrite-on-sign-in.
3. Extract pure portfolio calculations, currency conversion and display helpers.
4. Extract persistence behind one portfolio-storage adapter implementing the
   approved decision; no page/component should call portfolio keys directly.
5. Extract asset search/price load and edit-form logic into helpers/hooks.
6. Extract the summary, holdings list, charts, guest prompt and add/edit dialog
   into focused components; leave page composition/state wiring only.
7. Validate data preservation, local-first/remote sync and destructive
   clear-data paths in a disposable profile.

**Estimated files touched**

`src/app/portfolio-tracker/page.jsx`, `src/app/portfolio-tracker/pie.jsx`,
`src/components/add-asset-modal.jsx`, `src/components/clear-data-button.jsx`,
`src/components/auth-provider.jsx`; new portfolio components/hooks/lib storage
adapter; possibly `src/lib/default-watchlist.js` only if shared starter-data
conventions are formalized.

**Rollback risk:** High, and **critical for user data** during migration.
A failed migration must fall back to the last valid legacy record. Legacy keys
are read-once during migration; the canonical record is authoritative after
the first successful write. Clear Data must remove both canonical and legacy
keys.

**Testing checklist**

- [ ] All fixture variants load without crash or data loss.
- [ ] Guest add/edit/delete, currency preference, visibility preference and
      starter-portfolio seeding work after refresh.
- [ ] Sign-in remote overwrite/merge behaviour matches documented local-first
      policy; sign-out returns to the expected local portfolio.
- [ ] A migration is idempotent across refreshes/tabs and survives partial
      write/quota errors.
- [ ] Clear Data removes every live canonical and legacy portfolio key only
      after the user confirms; it does not claim to clear data it leaves behind.
- [ ] Pie/mini-chart loading and asset search still work after extraction.

**Checkpoints:** lint after each adapter/hook/component slice; build and full
storage fixture matrix before merging.

**Documentation checklist**

- [ ] `docs/conventions.md` and `docs/state-management.md`: canonical
      `aruna-portfolio` schema and clear-data scope.
- [ ] `docs/application-flow.md` and `README.md`: if observable persistence
      behaviour changes.
- [ ] `docs/architecture.md`, `docs/folder-structure.md`,
      `docs/ui-architecture.md` for component extraction.
- [ ] `docs/ai-session-handoff.md`.

**Recommended commits**

1. `refactor(portfolio): extract calculations and storage adapter`
3. `refactor(portfolio): extract data hooks and asset form`
4. `refactor(portfolio): extract visual sections and simplify route`
5. `test: add portfolio storage migration fixtures` (if a test harness is
   introduced; otherwise retain an executable/manual test protocol document)

## TD-9 — Local-storage decision (APPROVED: Option B)

**Decision:** One-time migration to canonical `aruna-portfolio`. This is a
small personal project with a very small active user base. Long-term
maintainability is preferred over preserving legacy storage indefinitely.

### Implementation policy

- Introduce a single canonical `localStorage` record named `aruna-portfolio`.
- Introduce a dedicated portfolio storage adapter responsible for all
  persistence. The rest of the application must never access `localStorage`
  directly for portfolio data.

### Migration policy (on first portfolio load)

1. Attempt to load `aruna-portfolio`.
2. If it exists and is valid, use it.
3. Otherwise, read the legacy portfolio keys (`portfolio_currency`,
   `portfolio_visibility_hidden`, `aruna_guest_portfolio`,
   `aruna_guest_portfolio_seeded`).
4. Convert them into the canonical schema.
5. Save the canonical record.
6. Continue using only the canonical record for all future reads and writes.

### Constraints

- Do **not** implement dual-read / dual-write synchronisation.
- Do **not** keep legacy keys synchronised after migration.
- Do **not** introduce a permanent compatibility layer.
- Legacy keys may remain in browser storage after migration but must no
  longer be read or written by the application.
- `ClearDataButton` must remove both the canonical record and all known
  legacy keys.
- All portfolio persistence must be centralised behind the storage adapter.

### Current persistence inventory

| Actual key | Current owner | Actual purpose | Documentation / operational issue |
|---|---|---|---|
| `aruna_auth` | Supabase browser client | Auth session | Documented correctly. |
| `aruna-theme` | `ThemeProvider` | Theme | Documented correctly. |
| `aruna_appearance_mode` | Appearance provider | Pro/lite mode | Documented in state management, missing from conventions key table. |
| `aruna_header_symbol_history` | Header search | Symbol history | Documented correctly. |
| `aruna-trial-state` | Trial provider | Trial state | Documented correctly. |
| `aruna_install_prompt_shown` | PWA install dialog | Dismissed install prompt | Unregistered in docs. |
| `aruna_last_election_symbol` | Chart page | Last chart symbol | Unregistered in docs; Clear Data does list it. |
| `sidebar_state` | shadcn sidebar | Sidebar state cookie, not localStorage | The conventions table calls it local storage; verify/update its storage type. |
| `portfolio_currency` | Portfolio page | Currency preference | Legacy — migrated to `aruna-portfolio`. |
| `portfolio_visibility_hidden` | Portfolio page | Balance visibility | Legacy — migrated to `aruna-portfolio`. |
| `aruna_guest_portfolio` | Portfolio page | Guest holdings array | Legacy — migrated to `aruna-portfolio`. |
| `aruna_guest_portfolio_seeded` | Portfolio page | Starter data sentinel | Legacy — migrated to `aruna-portfolio`. |

`ClearDataButton` is a hidden dependency: it currently removes `aruna_portfolio`
and `aruna_watchlist` (underscore names), but not the actual legacy keys or
the canonical `aruna-portfolio`. It must be updated to remove the canonical
record and all known legacy keys.

## Phase 4 — Shared data-access/configuration layer

**Execution order and atomic tasks**

1. Agree server/client module boundaries: logo cache is server-only; browser
   helpers only call existing API routes via `fetchEncodedJson()`.
2. Extract one server-only US-logo cache helper from finance/quotes routes;
   preserve MIME, cache-control, Supabase bucket and failure semantics.
3. Change one route at a time to use it; compare encoded response shape and
   logo URLs with baseline.
4. Extract shared browser helpers for symbol search/latest price and shared
   date-range builder; migrate Add Asset, Portfolio, then Chart consumers.
5. Move static provider bases and market catalog ownership into appropriate
   lib/config modules. Decide whether each base is a stable code constant or a
   deployment env variable before adding env surface.
6. Remove duplicate implementations only after all consumers use the shared
   contracts.

**Estimated files touched**

`src/app/api/{quotes,finance}/route.js`, `src/components/add-asset-modal.jsx`,
chart/portfolio consumers, `src/app/explore/page.jsx`, and new `src/lib/`
server/client/config modules. `.env.template`, `docs/environment.md` only if a
new approved deployment variable is introduced.

**Rollback risk:** Medium. Server helper extraction can break logo upload/cache
or accidentally cross a server/client boundary; client helper extraction can
change decoded error behaviour. Preserve route URLs/envelopes and commit server
and client changes separately.

**Testing checklist**

- [ ] Finance/quotes return the same encoded shape for valid/invalid symbol and
      no-Supabase/no-logo conditions.
- [ ] Logo miss, CDN failure, Supabase upload failure and cache hit work as
      before, without exposing service-role data to client bundles.
- [ ] Search debounce, latest-price lookup, empty result and error UI preserve
      current behaviour across Add Asset/Portfolio/Chart.
- [ ] Provider configuration works with documented env values and reasonable
      missing-env failure states.

**Checkpoints:** lint after each consumer migration; build after server-helper
extraction and at phase close; run representative API calls with the existing
encoded client contract.

**Documentation checklist**

- [ ] `docs/architecture.md`, `docs/folder-structure.md`, `docs/api.md`,
      `docs/integrations.md`.
- [ ] `docs/environment.md` and `.env.template` if env surface changes.
- [ ] `docs/ai-session-handoff.md`.

**Recommended commits**

1. `refactor(api): share server-side US logo cache`
2. `refactor(client): share symbol and latest-price access`
3. `refactor(config): centralize provider and market catalog configuration`
4. `docs: update data-access and integration contracts`

## Phase 5 — UI polish system

**Execution order and atomic tasks**

1. Define visual acceptance baselines for each spinner state and navigation
   surface before changing motion or color.
2. Replace full-page/fixed-canvas spinners with shape-matched skeletons for
   bubbles, rotation, discussion, normal chart and portfolio mini-chart.
3. Add shell/sidebar/sign-in skeleton work from UI-2 opportunistically where
   the affected component is already being changed.
4. Review `motion.js` against Radix animation ownership; apply shared tokens to
   custom nav/sidebar/data replacement only.
5. Redesign bottom navigation as a responsive, accessible mobile/tablet
   component; preserve current route matching and scroll-minimize behaviour.
6. Extract recurring dimensions/type/status styles into tokens/variants.
7. Reduce non-semantic color/glow/shadow treatments, then run contrast and
   market-semantics review.

**Estimated files touched**

`src/components/{market-bubbles,mobile-bottom-nav,desktop-navbar,
account-sidebar}.jsx`, `src/app/{idx-rotation,discussion,chart,
portfolio-tracker}/page.jsx`, `src/lib/motion.js`, `src/app/globals.css`, and
components extracted in P2/P3.

**Rollback risk:** Medium. Skeleton geometry and nav redesign alter perceived
performance and navigation affordances. Motion changes can cause double
animations or violate reduced-motion expectations; keep each surface isolated.

**Testing checklist**

- [ ] All listed loading states preserve the final layout’s header/content
      footprint and avoid a blank full-screen flash.
- [ ] Keyboard focus and screen-reader labels work for redesigned nav; route
      active state is correct for every tab.
- [ ] Motion works once per interaction, respects `prefers-reduced-motion`, and
      does not delay route navigation or dialog focus management.
- [ ] Dark/light contrast passes for semantic status colors; colored chart
      meaning remains understandable without color alone.
- [ ] UI verified at mobile/tablet/desktop and standalone PWA.

**Checkpoints:** lint after each surface; visual/device regression pass after
task 5 and phase close; build at phase boundary.

**Documentation checklist**

- [ ] `docs/ui-architecture.md`: skeleton, motion, nav, spacing and color.
- [ ] `docs/conventions.md`: class/variant policy.
- [ ] `docs/folder-structure.md` if components move.
- [ ] `docs/ai-session-handoff.md`.

**Recommended commits**

1. `feat(ui): add layout-matched loading skeletons`
2. `refactor(ui): standardize custom motion tokens`
3. `feat(ui): redesign responsive mobile bottom navigation`
4. `style(ui): consolidate spacing and restrained visual tokens`

**Executed as planned, with scope corrections:**

- UI-11 shrunk to two loading branches (chart normal-series, portfolio
  mini-chart) — the chart main skeleton and mini-chart no-data placeholder
  already existed from P2/P3.
- UI-1's discussion case was the `authLoading` gate; fixed as a message-shell
  skeleton (trial users skip it).
- UI-2 deferred to Phase 6; UI-3/UI-4/UI-6 were already resolved in Phase 0.
- `max-w-[900px]` full-bleed chart wrapper kept as intentional behaviour.

## Phase 6 — Remaining componentization

**Execution order and atomic tasks**

1. Use duplication evidence from P2/P3/P5 to identify patterns that occur in
   at least two features; reject one-off abstractions.
2. Define component APIs/cva variants for common metric cards, status chips,
   segmented controls and loading/empty rows.
3. Migrate one feature at a time: Explore first (least coupled), then
   Portfolio/Chart only for work deferred from their own phases.
4. Remove dead inline variants and consolidate visual tests/checklists.

**Estimated files touched**

`src/app/{explore,portfolio-tracker,chart}/page.jsx`, newly focused
`src/components/*`, and possibly selected `src/components/ui/*` primitives.

**Rollback risk:** Medium/high, as overly broad common components can erase
feature-specific behaviour. Keep presentation extraction separate from state
hook changes.

**Testing checklist**

- [x] Component props cover all existing visual states without feature-specific
      conditionals leaking into a generic primitive.
- [x] No new UI framework or state library; UI primitives remain shadcn
      compatible and use `cn()`.
- [x] Explore/Portfolio/Chart visual and interaction matrices match baseline.
- [x] Lint/build pass and bundle/runtime checks show no circular imports.

**Checkpoints:** lint after each feature migration; build before each merge;
phase-level visual regression after task 4.

**Documentation checklist**

- [x] `docs/architecture.md`, `docs/folder-structure.md`,
      `docs/ui-architecture.md`, `docs/conventions.md`.
- [x] `docs/ai-session-handoff.md`.

**Recommended commits**

1. `refactor(ui): extract shared explore presentation patterns`
2. `refactor(ui): extract approved portfolio and chart variants`
3. `docs: document shared component boundaries`

**Executed as planned, with scope corrections (approval-driven guardrails):**

- Order was correctness-first: the three extraction-leftover runtime bugs (B1,
  B2, B3) and a fourth (B4, watchlist `isStandalone`) were fixed before any
  lint tightening or refactor; `no-undef`/`no-unused-vars` were enabled and
  satisfied before component work began.
- Only one shared primitive was created (`SegmentedControl`); metric-row,
  empty-state and change-chip primitives were dropped for lack of genuine
  cross-feature reuse. `getChangeTone()` replaced a component as the change
  color fix.
- Chart extraction was limited to Trading Plan + Seasonality panels plus the
  gauge move; the other four info tabs stayed in the page after a checkpoint
  review (single-consumer grids, no ownership gain). Portfolio asset-type toggle
  and chart quarter-filter controls were intentionally left out of the
  segmented-control migration (form-toggle idiom / heatmap-matched square style).
- Commits consolidated to 10 buildable, reviewable boundaries (see
  `docs/ai-session-handoff.md`).

## Phase 7 — Cron decision/restoration track

**Execution order and atomic tasks**

1. Obtain product owner approval for “enabled schedule” versus “intentionally
   disabled” and identify the Vercel plan/current cron limits.
2. If enabling, calculate proposed UTC schedules for IDX/US and separately
   evaluate crypto/money-flow frequency, execution duration and overlap.
3. Review cron route authorization, Supabase write/truncate behaviour and
   manual invocation procedure in a safe environment.
4. Make the narrow `vercel.json` schedule/documentation change, or make the
   documentation-only intentional-disablement change.
5. Observe one run per enabled category and record result, duration, failures
   and data freshness.

**Estimated files touched**

`vercel.json`; possibly no source files. Documentation: `docs/deployment.md`,
`application-flow.md`, `api.md`, `known-issues.md`, `roadmap.md`, and
potentially `architecture.md` plus `ai-session-handoff.md`.

**Rollback risk:** Medium operational risk, low code risk. An incorrect schedule
can exceed plan limits, overlap truncate/write jobs, produce stale tables or
unexpected vendor load. Revert the schedule entry rather than modifying working
route logic unless evidence shows a route defect.

**Testing checklist**

- [ ] Manual authorized invocation for each enabled endpoint returns expected
      status and writes expected rows.
- [ ] Run duration/concurrency is within approved plan limits.
- [ ] No simultaneous job truncates data being generated by another job.
- [ ] Failure alerts/log ownership and stale-data user communication are known.
- [ ] If disabled, every documentation surface accurately says so.

**Checkpoints:** JSON validation for `vercel.json`; deploy-preview/prod
configuration review; manual endpoint checks before relying on the next schedule.

**Documentation checklist**

- [ ] `docs/deployment.md`, `docs/application-flow.md`, `docs/api.md`,
      `docs/known-issues.md`, `docs/roadmap.md`.
- [ ] `docs/architecture.md` only if data flow changes.
- [ ] `docs/ai-session-handoff.md`.

**Recommended commits**

1. `docs: record approved cron policy and Vercel limits`
2. `ops: restore approved Vercel cron schedule` (enabled option only)
3. `docs: document cron validation outcome`

## Parallelism, sequencing, and merge management

### Safe parallel work

- P0 deletion/comment cleanup can run beside P0 safe-area/touch-target work if
  each uses separate commits.
- After P1 is merged, P2 Chart and P3 Portfolio can run in parallel in separate
  branches. Assign ownership of shared `add-asset-modal.jsx` before starting;
  P3 should own it until P4.
- P7 decision discovery and Vercel plan research can run at any time; changing
  `vercel.json` waits for approval.
- P5 can prepare visual baselines and isolated bubble/rotation/discussion
  skeletons while P4 is underway, but should not edit Chart/Portfolio files
  until the respective extraction branch has merged.

### Work that must remain sequential

1. P1 must finish before P2/P3 so extracted hooks do not copy failing effect
   patterns.
2. The migration test matrix precedes any portfolio-key/code change in P3.
3. P2/P3 route boundaries precede P4 shared-helper consolidation.
4. P4’s client helper contract must settle before P5/P6 replace dependent UI
   data states broadly.
5. P5 design/token decisions precede P6 generic UI component extraction.
6. P7 schedule write waits on product approval and plan-limit validation.

### Hidden dependencies to resolve

- `ClearDataButton` has stale underscore keys and omits the canonical
  `aruna-portfolio` and all legacy portfolio keys; it is a data-safety
  dependency of Phase 3, not merely cosmetic cleanup.
- Docs currently disagree with code on several non-portfolio keys:
  appearance/install/chart-history keys, and `sidebar_state` storage type.
  These should be corrected as part of Phase 3 documentation work.
- `ThemeProvider` explicitly disables theme transitions. Motion standardization
  must preserve that hydration/flash prevention policy.
- `market-bubbles` is shared by safe-area/touch-target P0, purity P1 and
  skeleton/motion P5; avoid concurrent edits.
- `portfolio-tracker/page.jsx` is touched by P0, P1, P3, P5 and P6; it needs a
  single branch owner at any moment.
- `chart/page.jsx` is touched by P1, P2, P4, P5 and P6; P2 should merge before
  later chart work begins.
- Adding provider env variables requires deployment configuration outside the
  repository; do not land code that assumes undeployed variables exist.
- There is no documented automated test suite. Before destructive persistence
  work, agree whether to add a minimal test harness or keep a repeatable manual
  browser fixture protocol in the repo.

### Likely merge-conflict map

| File / area | Conflicting phases | Mitigation |
|---|---|---|
| `src/app/portfolio-tracker/page.jsx` | P0, P1, P3, P5, P6 | Merge in that order; P3 owns the file until its extraction lands. |
| `src/app/chart/page.jsx` | P1, P2, P4, P5, P6 | Land P1 first, then P2; make P4/P5/P6 changes against the decomposed files. |
| `src/components/market-bubbles.jsx` | P0, P1, P5 | Sequence P0 safe-area → P1 purity → P5 skeleton/motion. |
| `src/components/add-asset-modal.jsx` | P0, P1, P3, P4 | Fold P0/P1 small fixes first; P3 owns extraction; P4 migrates final helper API. |
| `src/lib/utils.js` / new constants | P0, P2, P3, P5, P6 | Reserve shared helper ownership; small additive commits, no simultaneous formatter/token rewrites. |
| `src/app/globals.css` | P0, P5 | P0 establishes safe-area only; P5 layers tokens/motion afterward. |
| docs key/state tables | P3, P4, P5, P7 | Update docs in the same commit as the behaviour/decision; rebase before final doc commit. |
| `vercel.json` / deployment docs | P7 and any env work from P4 | P7 owns schedule config; coordinate P4 only if new env variables change deployment instructions. |

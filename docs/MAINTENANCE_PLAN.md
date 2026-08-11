# Maintenance Plan

Synthesized from `docs/DOCS_DRIFT_REPORT.md`, `docs/TECH_DEBT.md`,
`docs/UI_AUDIT.md` (all read-only audits, commit `d050c9e`). Phases are
ordered by dependency blast radius, not by source report — a phase that
fixes an assumption every later phase would otherwise inherit comes first;
shared-code changes come before UI polish in the same files; large
refactors come last, after quick wins build confidence. Run with
`/execute-phase`.

---

## Phase 1 — Foundation: doc corrections + the fix that makes them true

**Goal:** eliminate false architectural claims (encoding, auth, CORS,
migration safety) that any later phase — or any agent reading `CLAUDE.md`
first — would otherwise inherit as fact.

**Items:**
- [x] P0 (S) — Wrap `discussions/route.js:246-249` DELETE config-missing
  branch in `encodePayload()` — `src/app/api/discussions/route.js`. Makes
  the "GET/POST/DELETE all encode" claim true at the source instead of
  editing the 6 docs that repeat it.
- [x] P0 (S) — Fix ADR-006 ("no server-side session cookies") to note the
  discussions cookie-session exception — `docs/architecture-decisions.md`
- [x] P0 (S) — Fix ADR-009 + CORS section (`buildUnauthorizedResponse`
  doesn't exist in `src/proxy.js`, isn't merely commented out) —
  `docs/architecture-decisions.md`, `docs/known-issues.md`. Also fixed
  ADR-001 (found stale during execution — "except discussions and cron" →
  "except cron", not called out separately in the plan file but same root
  cause).
- [x] P1 (S) — Fix migration-strategy claim: `setup.sql` uses
  `create table if not exists`, never `DROP TABLE` — `docs/database.md`
- [x] P1 (S) — Fix localStorage key `aruna-watchlist` → `aruna_watchlist` —
  `docs/conventions.md`, `docs/state-management.md`
- [x] P2 (S) — Fix "no global error boundary" claim (`error.jsx` /
  `global-error.jsx` exist) — `docs/coding-standards.md`
- [x] P2 (S) — Sync `yahoo-finance2` version `^3.14.3` → `^4.0.0` —
  `docs/tech-stack.md`, `docs/dependencies.md`
- [x] P2 (S) — Add `mini-chart.jsx`, `toast.jsx` to component tree —
  `docs/folder-structure.md`

**Depends on:** none

---

## Phase 2 — API response-encoding safeguards

**Goal:** close real `encodePayload()` gaps in shared API routes before any
UI work touches the same files.

**Items:**
- [x] P0 (S) — Wrap the empty-state success branch in
  `src/app/api/msci/route.js:52-59` — currently returns raw JSON,
  `fetchEncodedJson()` throws on it (Critical: real bug, not just
  obfuscation gap)
- [x] P0 (S) — Wrap error branches (12 call sites) with `encodePayload()` —
  `src/app/api/bubbles/route.js`, `src/app/api/momentum/route.js`,
  `src/app/api/msci/route.js`, `src/app/api/rotation/route.js`

**Depends on:** Phase 1 (doc claims about encoding must already be correct
so this fix isn't read against stale docs)

---

## Phase 3 — Dead code deletion

**Goal:** remove confirmed-zero-import code before later phases touch
adjacent files, shrinking review surface.

**Items:**
- [x] P1 (S) — Delete `src/components/ui/sidebar.jsx` (680 lines, zero
  imports; also carries the `width`/`left`/`right` transitions the 60fps
  goal flags) — see Unresolved Questions if a near-term collapsible
  sidebar is planned
- [x] P2 (S) — Delete `src/components/ui/radio-group.jsx` (zero imports)
- [x] P2 (S) — Delete dead lib exports: `isCryptoTicker`
  (`src/lib/chart-helpers.js:297`), `dayOfYearToMonthDate`
  (`src/lib/seasonalData.js:132`), `sortByNearestInclusion`
  (`src/lib/msci-calculations.js:149`), `formatDecimalPercent`
  (`src/lib/utils.js:123`) — **excludes** `calculateSummaryStats`, wired up
  in Phase 4 instead of deleted

**Depends on:** none

---

## Phase 4 — Dedupe business logic

**Goal:** replace inline reimplementations with the existing `lib`
functions they duplicate.

**Items:**
- [x] P1 (S) — Import `calculateSummaryStats` from
  `src/lib/msci-calculations.js:158` into `src/app/api/msci/route.js`,
  delete the inline `calculateStats` (lines 149-156)
- [x] P1 (M) — Replace `formatPriceValue`/`formatPlainNumber` in
  `src/app/chart/page.jsx:562-601` with `lib/utils.js#formatPrice`.
  Rescoped during execution: `priceInfo.fiftyTwoWeekRange`/`dayRange` are
  already-formatted range strings from `api/fundamentals/route.js`'s
  `formatRange()` (e.g. `"185.2 - 195.4"`), not numbers — routing them
  through `formatPrice()` would replace them with the fallback dash.
  `formatPlainNumber` kept as a thin wrapper delegating its numeric branch
  to `formatPrice()` (dedupes the `toLocaleString` logic) while preserving
  the non-numeric string passthrough. `formatPriceValue` (purely numeric,
  used as a child-component prop) was replaced outright.

**Depends on:** Phase 3 (resolves which lib export is dead vs. wired-up in
the same pass, avoids a delete/reuse conflict)

---

## Phase 5 — Motion & microinteraction quick wins

**Goal:** cheap, isolated, high-visible-impact fixes toward the 60fps/
native-feel goal — composited-property transitions, touch targets, timing
consistency. Low risk, good confidence-builder before the large refactors.

**Items:**
- [x] P1 (S) — Progress-bar fills: swap `width` + `transition-all` for
  `transform: scaleX()` — `src/app/chart/page.jsx:1214,1660,1823`,
  `src/app/msci/page.jsx:176-177`. Rescoped: `chart/page.jsx:1823` (the
  stacked analyst-recommendation-trend bar) is a segmented multi-sibling
  bar where each `<div>`'s literal `width` sets its flex-item layout size,
  not a single-value fill inside a track — `scaleX` only transforms
  visually and doesn't affect flex layout, so converting it would collapse
  the segments. Left as `width` + `transition-all`; the other 3 (single-fill
  progress bars) converted.
- [x] P1 (S) — Fullscreen chart back control: replace bare
  `<div onClick>` with `<Button variant="ghost" size="icon">` (44px target,
  hover/active states) — `src/app/chart/page.jsx:2498-2503`
- [x] P2 (S) — Replace hardcoded `duration-200` with `DURATION_CLASS.base`
  — `ticker-row.jsx:31`, `trending-marquee.jsx:25`,
  `explore/page.jsx:1041,1140`, `portfolio-tracker/page.jsx:460`,
  `watchlist/page.jsx:336`, `pricing/page.jsx:103`, `trial-banner.jsx:56`
- [x] P2 (S) — Toast dismiss: replace `✕` glyph with lucide `<X>` —
  `src/components/toast.jsx:64-71`
- [x] P2 (S) — Drop `box-shadow` from focus-ring transition list —
  `src/components/ui/input.jsx:15`, `src/components/ui/select.jsx:38`

**Depends on:** none

---

## Phase 6 — Component primitive consolidation

**Goal:** replace hand-rolled duplicated markup with existing primitives,
in the shared UI directory Phase 3 already cleaned up.

**Items:**
- [x] P0 (S) — Replace 8 raw `<input>` elements with `<Input>` —
  `src/components/add-asset-modal.jsx:150,180,210`,
  `src/app/portfolio-tracker/page.jsx:879,908,938,953,967`
- [x] P1 (S) — Discussion page: extract a `MessageListSkeleton` from the
  existing auth-loading skeleton, reuse it for `messagesLoading` instead of
  the centered `Loader2` — `src/app/discussion/page.jsx:305-332,431-434`
- [x] P2 (S) — Replace duplicated primary-CTA className with `<Button>` —
  `src/app/not-found.jsx:28,34`, `src/app/error.jsx:22`. Rescoped:
  `src/app/global-error.jsx:17` kept as hand-rolled className — it replaces
  the entire root `<html>`/`<body>` and doesn't import `globals.css`
  itself, so Tailwind utility classes (on `Button` or the existing markup
  alike) aren't reliably guaranteed to be loaded there regardless of which
  markup is used; not swapping avoids introducing a false sense that this
  path is safer.
- [x] P2 (M) — FLIP-animate watchlist drag-reorder sibling rows instead of
  instant jump — `src/components/manage-watchlist-dialog.jsx:224-253`

**Depends on:** Phase 3 (dead `ui/` scaffolding removed first)

---

## Phase 7 — Large page decomposition

**Goal:** break down the three oversized feature pages into extracted
components, reusing the primitives Phase 6 already consolidated. Highest
effort — scheduled last, after the quicker phases have de-risked the
shared pieces these pages will import.

**Items:**
- [x] P2 (L) — Extract repeated inline conditional Tailwind blocks into
  components — `src/app/chart/page.jsx` (2,773 lines, e.g. 2253-2271,
  2566-2585). Rescoped: the two named ranges were analyst-opinion/
  recommendation-trend blocks already narrow and non-repeated; extracted
  the actual duplicated-markup case instead — the loading-skeleton JSX
  (main chart card + sidebar), pulled into `ChartMainSkeleton` and
  `ChartSidebarSkeleton` components, both pure (no closures beyond the
  module-level `CHART_HEIGHT_CLASS` constant and already-imported UI
  primitives).
- [x] P2 (L) — Extract market card grid into a component —
  `src/app/explore/page.jsx` (1,422 lines, e.g. 1124-1170). Extracted
  `MarketSymbolCard({ item, marketTimeframe })`, placed beside the
  existing `MarketSymbolCardSkeleton`; grid `.map()` now renders it
  directly.
- [x] P2 (L) — Extract add-asset form section into a component —
  `src/app/portfolio-tracker/page.jsx` (1,013 lines, e.g. 860-980).
  Extracted `AddAssetForm` taking the asset-type/symbol-search/form-field
  state as props (kept in the parent — the form has no independent
  lifecycle).
- [x] P2 (M) — Promote recurring arbitrary spacing values
  (`mt-[5px]`, `max-w-[900px]`-style) to constants/scale, chart-specific
  pass — `src/app/chart/page.jsx`. Rescoped: audited every `[Npx]`
  arbitrary value in the file — only `h-[260px]` (the two secondary
  earnings/analyst chart cards) was a genuine repeat, promoted to
  `SECONDARY_CHART_HEIGHT_CLASS` alongside the existing
  `CHART_HEIGHT_CLASS`. `max-w-[900px]`, `max-w-[768px]`, `h-[220px]` etc.
  each appear exactly once — left as one-offs per the item's own scope
  note.

**Depends on:** Phase 6 (extraction should reuse `<Input>`/`<Button>`/etc.,
not re-duplicate the markup Phase 6 just consolidated)

---

## Unresolved questions

1. **Scope gap vs. the original ask.** These three audits found the app's
   UI foundation already sound — no gradients, no generic-AI-slop tells,
   working skeleton coverage, a real motion-token system. What they found
   is debt and rough edges, not a missing design system. Making the app
   *feel like a native Mac/iOS app* (spring-physics page transitions,
   gesture-driven navigation, haptic-style feedback) is a different, larger
   scope than "fix what's broken" — none of the 7 phases above add that.
   Decide: is this maintenance plan sufficient, or does a separate
   design-system phase need to be scoped after it?
2. **CORS.** `src/proxy.js` has no origin-blocking logic in any form (not
   commented out — never existed in the current file). Is permissive CORS
   an intentional decision that just needs documenting as such (matches
   `docs/authorization.md`'s "decorative" framing), or should strict
   origin blocking actually be implemented? Affects whether Phase 1's
   ADR-009 fix is a doc correction or a spec for new Phase-2-adjacent work.
3. **`sidebar.jsx` deletion (Phase 3).** Confirm there's no near-term plan
   for a collapsible desktop sidebar before deleting — if one exists, it
   should instead be fixed (transform-based transitions) and wired up
   rather than removed.
4. **Discussion cookie-session exception.** Now that ADR-006 will be
   corrected (Phase 1) to acknowledge discussions' server-side session
   cookie, should other authenticated routes adopt the same cookie-session
   pattern instead of the Bearer-token pattern, or should this stay a
   documented one-off? No action item depends on the answer yet, but it
   affects how future auth-touching work should be planned.

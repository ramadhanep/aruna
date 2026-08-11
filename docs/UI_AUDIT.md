# UI/UX Audit

Audited against `docs/ui-architecture.md` and `src/app/globals.css` on
2026-08-12. Read-only pass — no source files were changed. Line numbers are
current as of this commit (`d050c9e`). Supersedes the 2026-07-31 audit below;
the resolution table has been re-verified against the current tree.

## Resolution status (re-verified this pass)

| Finding | Status |
|---|---|
| UI-1 (full-screen spinners on bubbles/rotation/discussion) | CONFIRMED RESOLVED — `ScatterSkeleton` in `market-bubbles.jsx:387`, `idx-rotation/page.jsx:150`; discussion auth-gate skeleton at `discussion/page.jsx:305-332` |
| UI-2 (access/route loading) | CONFIRMED RESOLVED — `app-layout-client.jsx:77-80` skeletons the protected content shell |
| UI-3 (bottom-nav safe area) | RESOLVED (unchanged) |
| UI-4 (full-screen tool safe areas) | RESOLVED (unchanged) |
| UI-5 (motion policy: `src/lib/motion.js`) | PARTIALLY REGRESSED — `account-sidebar.jsx`/`mobile-bottom-nav.jsx` correctly use `DURATION_CLASS`, but several newer surfaces hardcode `duration-200` instead of adopting it (see UI-14 below) |
| UI-6 (44px touch targets) | MOSTLY RESOLVED, one new instance found (UI-15) |
| UI-7 (bottom-nav pill) | RESOLVED (unchanged) |
| UI-8 (class-string componentization) | STILL OPEN, new concrete instance found (UI-12) |
| UI-9 (arbitrary values) | STILL OPEN (not re-audited in depth this pass; scope unchanged) |
| UI-10 (color/elevation) | RESOLVED (unchanged, no gradients/purple/heavy shadows found anywhere in `src/app`/`src/components` this pass) |
| UI-11 (chart loading quality) | RESOLVED (unchanged) |

## Still-open findings carried from the 2026-07-31 audit

### UI-8 — Large class strings and feature rendering should be componentized

- **Severity:** Medium **Effort:** L
- **Reference:** `src/app/chart/page.jsx` (2,773 lines, dozens of inline
  conditional Tailwind blocks, e.g. `2253-2271`, `2566-2585`);
  `src/app/portfolio-tracker/page.jsx` (1,013 lines, e.g. `860-980` add-asset
  form); `src/app/explore/page.jsx` (1,422 lines, e.g. `1124-1170` market card
  grid). Unchanged in scope since the prior audit; still not decomposed.
- **What is wrong:** The three feature pages still contain hundreds of lines of
  inline conditional Tailwind per page. Recurring cards/badges/tabs/empty rows
  are copy-pasted rather than extracted (see UI-12/UI-20 above for two
  concrete, now-fixable instances of this same pattern).
- **Suggested direction:** Extract feature cards/section components and use
  `cn()`/cva variants for recurring status chips, segmented controls, metric
  cards. Do not over-abstract one-off chart markup. Treat UI-12/UI-20 as the
  first small cuts of this larger item.

### UI-9 — Spacing and typography use some arbitrary, non-token values

- **Severity:** Low **Effort:** M
- **Reference:** not re-audited line-by-line this pass (page line numbers have
  drifted since the 07-31 audit due to the chart/portfolio decompositions
  noted in that audit's original header). Spot-checked this pass: padding
  values are largely consistent (`p-3`/`p-4`/`p-6`, `gap-2.5`/`gap-3`/`gap-4`
  dominate; only `p-3.5`/`p-2.5`/`p-5` appear as isolated one-offs at
  `src/app/explore/page.jsx:345,1140`, `src/app/chart/page.jsx:1775`,
  `src/components/chart-trading-plan-panel.jsx:424`, `src/app/error.jsx:6`,
  `src/app/offline/page.jsx:9` — none is a strong enough pattern break to flag
  individually, but arbitrary pixel values in chart-specific sizing likely
  still exist per the original audit's `mt-[5px]`/`max-w-[900px]` findings and
  were not re-verified here).
- **Suggested direction:** Unchanged from prior audit — promote genuinely
  recurring chart/nav dimensions to component constants, use standard spacing
  steps elsewhere. Lower priority than UI-8; needs a dedicated pass over
  `chart/page.jsx` specifically.

## New findings (2026-08-12 pass)

### UI-12 — Hand-rolled `<input>` styling duplicated instead of the existing `<Input>` primitive

- **Severity:** High **Effort:** S
- **Reference:** `src/components/add-asset-modal.jsx:150,180,210`;
  `src/app/portfolio-tracker/page.jsx:879,908,938,953,967`.
- **What is wrong:** Eight raw `<input>` elements across two files repeat the
  identical 15-word className
  (`"w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"`)
  instead of using `src/components/ui/input.jsx`'s `<Input>`, which already
  encodes this exact style plus disabled/invalid states.
- **Why it feels off:** This is the textbook "shadcn primitive exists, hand-rolled
  div/input used anyway" pattern the audit is meant to catch — any future
  focus-ring/height/radius tweak now needs 8 coordinated edits.
- **Suggested direction:** Swap all 8 for `<Input>` from `@/components/ui/input`;
  mechanical, no visual change expected.

### UI-13 — Discussion page has a shape-matched skeleton for auth, but reverts to a bare spinner for the actual message fetch

- **Severity:** Medium **Effort:** S
- **Reference:** `src/app/discussion/page.jsx:305-332` (chat-bubble skeleton,
  used only while `authLoading`) vs. `discussion/page.jsx:431-434`
  (`messagesLoading` renders a centered `<Loader2>` with no reserved layout).
- **What is wrong:** The page already has a message-bubble-shaped skeleton one
  state earlier, but doesn't reuse it for `messagesLoading`, which is the state
  users actually see on every page load once authenticated.
- **Why it feels off:** Contradicts the documented policy in
  `docs/ui-architecture.md` ("Loading states reserve the final layout instead
  of showing centered spinners... Whole-screen/centered `Loader2` is reserved
  for user-initiated actions, never initial load") within the same file that
  demonstrates the correct pattern one function up.
- **Suggested direction:** Extract the bubble-skeleton block into a small
  `MessageListSkeleton` and render it for both `authLoading` and
  `messagesLoading`.

### UI-14 — `duration-200` hardcoded in several places instead of `DURATION_CLASS.base` from `src/lib/motion.js`

- **Severity:** Low **Effort:** S
- **Reference:** `src/components/ticker-row.jsx:31`;
  `src/components/trending-marquee.jsx:25`; `src/app/explore/page.jsx:1041,1140`;
  `src/app/portfolio-tracker/page.jsx:460`; `src/app/watchlist/page.jsx:336`;
  `src/app/pricing/page.jsx:103`; `src/components/trial-banner.jsx:56`.
- **What is wrong:** `src/lib/motion.js` documents itself as "the single timing
  policy" (`DURATION.base = 250ms` → `DURATION_CLASS.base`), and
  `account-sidebar.jsx`/`mobile-bottom-nav.jsx` follow it correctly, but seven
  other files hardcode Tailwind's default `duration-200` (200ms) directly.
- **Why it feels off:** Two adjacent hover/tab transitions in the app now run
  at very slightly different speeds (200ms vs 250ms) for no reason — small, but
  exactly the kind of drift the shared token was written to prevent.
- **Suggested direction:** Replace literal `duration-200` with
  `DURATION_CLASS.base` via `cn()` in these seven spots.

### UI-15 — Fullscreen chart dialog back control is a bare `<div onClick>` with no hover/active feedback or touch target

- **Severity:** Medium **Effort:** S
- **Reference:** `src/app/chart/page.jsx:2498-2503`.
- **What is wrong:** Unlike every other icon-affordance in the app (buttons
  with `hover:bg-accent`, `active:scale-[.98]` via `buttonVariants`), this back
  arrow is a plain `<div className="absolute top-5 left-5 cursor-pointer" onClick=...>`
  wrapping a 24px icon with zero padding — no `hover:`/`active:` state, not a
  `<button>`, and well under the documented 44×44px touch target minimum
  (`docs/ui-architecture.md` "Mobile Touch Targets").
- **Why it feels off:** It's the only exit control in a fullscreen modal and
  gives no visual feedback that it's interactive or was tapped.
- **Suggested direction:** Use `<Button variant="ghost" size="icon">` (or at
  minimum `p-2.5` + `hover:bg-accent` + `rounded-full`) so it matches every
  other icon control's feedback and hit-area conventions.

### UI-16 — Progress-bar fills animate `width` via `transition-all` instead of a composited property

- **Severity:** Low **Effort:** S
- **Reference:** `src/app/chart/page.jsx:1214,1660,1823`;
  `src/app/msci/page.jsx:176-177`.
- **What is wrong:** Four progress-bar fills set `style={{ width: '${pct}%' }}`
  on an element also carrying `transition-all` (or `transition-all bg-emerald-600...`).
  `width` is a layout property — animating it triggers reflow, not just
  compositing, which is exactly the class of transition the 60fps/native-feel
  goal wants avoided.
- **Why it feels off:** Not currently causing visible jank (updates are
  infrequent, one bar at a time) but is the wrong primitive to build on, and
  will get worse if these fills are ever driven by frequently-updating data
  (e.g. live money-flow score).
- **Suggested direction:** Render the fill as `transform: scaleX(pct/100)` with
  `transform-origin: left` on a full-width element instead of animating
  `width`, and swap `transition-all` for `transition-transform`.

### UI-17 — Drag-to-reorder in the watchlist manager only fades the dragged row; sibling rows jump instead of sliding into place

- **Severity:** Medium **Effort:** M
- **Reference:** `src/components/manage-watchlist-dialog.jsx:224-253`
  (custom pointer-events drag, `transition-opacity` only on `draggingIndex`).
- **What is wrong:** The dragged item gets `opacity-60` during drag, but the
  other rows that shift up/down to make room re-render at their new array
  index with no transition — a discrete instant jump each time the dragged
  item crosses a boundary, rather than a settle animation.
- **Why it feels off:** This is precisely the "list reordering" microinteraction
  gap called out for smoothing — reordering here reads as a data re-render, not
  a physical reorder.
- **Suggested direction:** Track each row's previous vs. new offset (simple
  FLIP: measure before/after, apply an inverted `translateY` then transition
  it to `0` over `DURATION.fast`) so siblings slide rather than jump. Keep the
  existing opacity treatment for the actively dragged row.

### UI-18 — `src/components/ui/sidebar.jsx` is unused, dead shadcn boilerplate that also animates `width`/`left`/`right`

- **Severity:** Low **Effort:** S
- **Reference:** `src/components/ui/sidebar.jsx` (whole file, ~760 lines);
  no import of `@/components/ui/sidebar` exists anywhere else in `src/`.
  Layout-animating spots specifically: `sidebar.jsx:192`
  (`transition-[width] duration-200 ease-linear`) and `sidebar.jsx:202`
  (`transition-[left,right,width] duration-200 ease-linear`).
- **What is wrong:** Aruna's real navigation is `desktop-navbar.jsx` +
  `account-sidebar.jsx` (custom-built, already uses `DURATION_CLASS`); this
  generic collapsible-sidebar shadcn primitive was scaffolded but never wired
  up, and if it ever is, it ships the exact width/left/right transition
  pattern this audit is asked to flag.
- **Suggested direction:** Delete the file if there's no near-term plan to use
  it (grep confirms zero imports), or if kept for a future collapsible desktop
  sidebar, swap the flagged transitions for `transform: translateX()` +
  `width` only on the CSS var (not the transitioned property) before wiring it
  up.

### UI-19 — Toast dismiss control uses a raw `✕` glyph instead of the app's lucide icon set

- **Severity:** Low **Effort:** S
- **Reference:** `src/components/toast.jsx:64-71` (glyph) vs. `toast.jsx:4`
  (`CheckCircle2`/`AlertTriangle` from `lucide-react` used two lines above it).
- **What is wrong:** Every other icon in the toast (and essentially the whole
  app) is a lucide component; the close button alone is a plain text
  character, which renders at a different optical weight/alignment than the
  `size-4` lucide icons beside it.
- **Suggested direction:** Replace `✕` with `<X className="size-4" />` from
  `lucide-react` (already a dependency, already imported elsewhere in this
  file's neighbors).

### UI-20 — Duplicated primary-CTA button className across error/empty-state pages instead of the existing `<Button>` primitive

- **Severity:** Low **Effort:** S
- **Reference:** `src/app/not-found.jsx:28,34`; `src/app/error.jsx:22`;
  `src/app/global-error.jsx:17` — all three hand-roll
  `"inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"`
  verbatim. Contrast with `src/app/offline/page.jsx:18-23`, the sibling
  empty-state page, which correctly uses `<Button className="rounded-full px-6">`.
- **What is wrong:** Same "primitive exists, three of four sibling pages
  reimplement it by hand" pattern as UI-12, on the app's four fallback/error
  routes specifically.
- **Suggested direction:** Use `<Button size="lg" className="rounded-full">`
  (or `buttonVariants({ size: "lg" })` for the plain `<Link>` cases in
  `not-found.jsx`) in all three files, matching `offline/page.jsx`.
  `global-error.jsx` needs `Button` importable outside the themed shell — verify
  it renders acceptably in the un-styled `<html>` fallback before swapping.

### UI-21 — Minor: focus-ring transitions include `box-shadow` on the two lowest-level form primitives

- **Severity:** Low **Effort:** S
- **Reference:** `src/components/ui/input.jsx:15`
  (`transition-[color,border-color,box-shadow]`); `src/components/ui/select.jsx:38`
  (same pattern).
- **What is wrong:** `box-shadow` is a non-composited/paint property. Here it's
  only the Tailwind `ring` utility firing on focus (not continuous or
  high-frequency), so real-world jank risk is minimal, but it's the one
  instance in the primitive layer that doesn't follow the transform/opacity
  rule the rest of the system already follows (e.g. `button.jsx`'s
  `transition-[background-color,color,border-color,opacity,transform]`).
- **Suggested direction:** Low priority; only worth touching if these
  primitives are revisited for another reason. Could drop `box-shadow` from
  the transition list since the ring appears/disappears crisply without it.

## Top 5 by severity/effort (this pass)

1. **UI-12 (High/S)** — 8 duplicated raw `<input>` elements in
   `add-asset-modal.jsx` and `portfolio-tracker/page.jsx` should use the
   existing `<Input>` primitive.
2. **UI-13 (Medium/S)** — Discussion page's message-loading state regresses to
   a centered spinner despite an existing shape-matched skeleton one function
   above it, contradicting the app's own documented loading policy.
3. **UI-15 (Medium/S)** — Fullscreen chart's back control is a `<div onClick>`
   with no hover/active feedback and a sub-44px hit area.
4. **UI-17 (Medium/M)** — Watchlist drag-reorder siblings jump instead of
   sliding into place; the one genuine "list reordering" microinteraction gap
   found.
5. **UI-16 (Low/S)** — Four progress-bar fills animate `width` via
   `transition-all`; cheap fix to `transform: scaleX()` ahead of the 60fps/
   native-feel goal, before any of these bars gets driven by live data.

## Notes on what's already solid (no action needed)

- No gradients, purple/blue accent washes, or emoji-as-primary-icon usage
  found anywhere in `src/app`/`src/components` (checked via pattern search
  across all `.jsx`/`.js` files) — the monochrome/flat identity described in
  `globals.css`'s header comment is intact.
- Skeleton/shimmer coverage is broad and largely shape-matched: `explore`,
  `watchlist`, `msci`, `money-flow`, `idx-momentum`, `idx-rotation`,
  `portfolio-tracker`, `signin`, `chart`, and `app-layout-client` all reserve
  final layout via `<Skeleton>`/`TickerRowSkeleton`/`ScatterSkeleton` rather
  than blank/spinner states. UI-13 above is the one regression found.
- `button.jsx`'s `buttonVariants` already restricts its transition to
  `background-color,color,border-color,opacity,transform` and uses
  `active:scale-[.98]` — the correct composited-property pattern; most of the
  codebase's interactive elements build on it correctly.

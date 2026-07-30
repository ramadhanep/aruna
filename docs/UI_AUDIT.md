# UI/UX Audit

Audited against `docs/ui-architecture.md` on 2026-07-31. Findings are based on
the implemented component states and CSS (not a claim of cross-device visual
testing). This is an audit only; no UI was changed.

## Findings

### UI-1 — Three data-heavy visualizations replace the whole screen with a spinner

- **Reference:** `src/components/market-bubbles.jsx:372-378`; 
  `src/app/idx-rotation/page.jsx:146-152`; `src/app/discussion/page.jsx:297-304`.
- **What is wrong:** Initial load returns a full-viewport `Loader2` rather than
  a skeleton matching the bubble field, rotation plot, or discussion feed.
- **Why it feels off:** The documented shimmer/skeleton pattern is used well on
  watchlist, explore, MSCI and portfolio. These routes instead flash empty
  space, then abruptly replace it, particularly noticeable in installed PWA.
- **Suggested direction:** Reserve the final canvas/feed/header geometry and
  use a muted skeleton/shimmer grid, plot scaffold, and message rows.
- **Effort:** M

### UI-2 — Access and route loading use generic spinners rather than layout-shaped placeholders

- **Reference:** `src/components/app-layout-client.jsx:72-82`; 
  `src/app/signin/page.jsx:90-98`; `src/components/account-sidebar.jsx:424-432`.
- **What is wrong:** Auth gating, sign-in bootstrap and sidebar loading show a
  centered spinner without preserving the navbar/page/sidebar shape.
- **Why it feels off:** It creates a blank flash and vertical reflow before
  content appears, unlike the intended mobile/desktop shell.
- **Suggested direction:** Keep the shell in place and skeleton the protected
  content/sidebar’s actual rows. Retain a compact inline status only for an
  action initiated by the user.
- **Effort:** M

### UI-3 — Safe-area support exists but is not applied to the floating mobile nav

- **Reference:** defined at `src/app/globals.css:149-153`; mobile nav at
  `src/components/mobile-bottom-nav.jsx:78`; page clearance at
  `src/components/app-layout-client.jsx:128`.
- **What is wrong:** `.pb-safe` is defined but unused. The nav is fixed at
  `bottom-3`, while content reserves fixed `pb-24`; neither includes
  `safe-area-inset-bottom`.
- **Why it feels off:** On iPhones with a home indicator, the 300px pill can sit
  too low and obscure the last interactive row. Installed-PWA mode therefore
  still feels browser-like at the bottom edge.
- **Suggested direction:** Add bottom safe-area padding/offset to both nav and
  main clearance, and validate minimized state on iOS standalone mode.
- **Effort:** S

### UI-4 — Full-screen tool pages ignore top/bottom safe areas

- **Reference:** `src/app/idx-rotation/page.jsx:154-156`; 
  `src/components/market-bubbles.jsx:381-385`.
- **What is wrong:** Fixed, edge-to-edge visualizations position controls at
  `top-0` and use fixed viewport heights without safe-area insets.
- **Why it feels off:** PWA status-bar/notch areas can crowd or partially cover
  the back/download controls, exactly where the user needs a reliable escape.
- **Suggested direction:** Give full-screen tool chrome safe-area-aware top and
  bottom padding; test standalone iOS and Android with browser chrome hidden.
- **Effort:** S

### UI-5 — Transition policy is inconsistent despite shared motion tokens

- **Reference:** canonical tokens in `src/lib/motion.js:31-47`; hardcoded
  timings in `src/components/desktop-navbar.jsx:78,107,111` (200ms / 150ms),
  `src/components/account-sidebar.jsx:417-424` (300ms `ease-out`),
  `src/components/mobile-bottom-nav.jsx:78,98,105` (200ms), and
  `src/components/ui/sheet.jsx:60` (open 500ms, close 300ms).
- **What is wrong:** The documented motion helper defines 150/250/400ms,
  but only explore and symbol search use it. Other navigation/dialog surfaces
  hardcode distinct durations/eases; full-screen page data swaps are instant.
- **Why it feels off:** Similar interactions open at visibly different speeds,
  and skeleton-to-data/tab changes lack a coherent transition.
- **Suggested direction:** Treat `motion.js` as the single timing policy; align
  non-Radix navigation surfaces and add modest opacity transitions on data/tab
  replacement (without delaying accessibility or navigation).
- **Effort:** M

### UI-6 — Touch targets are too small in full-screen tool headers

- **Reference:** `src/app/idx-rotation/page.jsx:159-172`; 
  `src/components/market-bubbles.jsx:385-413`.
- **What is wrong:** Back/download controls use `p-1.5` around a 24px icon,
  producing about a 36px target, below the generally expected 44px mobile
  target. The adjacent segmented buttons are visually compact as well.
- **Why it feels off:** These high-frequency controls are at the device edge,
  where missed taps feel especially clumsy.
- **Suggested direction:** Establish a 44px minimum control variant for mobile
  tool chrome while preserving the compact visual icon.
- **Effort:** S

### UI-7 — The mobile bottom nav is an inconsistent, excessively rounded pill

- **Reference:** `src/components/mobile-bottom-nav.jsx:78-105`.
- **What is wrong:** It is a fixed-width `w-[300px]`, `rounded-full` floating
  card whose links have no visible text labels, while the rest of the terminal
  UI relies mostly on restrained `rounded-md`/`rounded-lg` surfaces.
- **Why it feels off:** The oversized pill plus four icon-only targets reads as
  a generic mobile template rather than the quiet, dense Aruna navigation.
  Fixed 300px also leaves awkward margins on tablets even though mobile chrome
  covers widths through 1023px.
- **Suggested direction:** Use a responsive nav width and a compact active label
  or accessible visible caption; make corner treatment and border weight match
  desktop navigation. Preserve the scroll-minimize behaviour.
- **Effort:** M

### UI-8 — Large class strings and feature rendering should be componentized

- **Reference:** `src/app/chart/page.jsx:2702-2911,4240-4656`;
  `src/app/portfolio-tracker/page.jsx:1109-1756`; 
  `src/app/explore/page.jsx:979-1525`; 
  `src/components/ui/button.jsx:8`; `src/components/ui/select.jsx:38,62`.
- **What is wrong:** The three feature pages contain hundreds/thousands of
  lines of inline conditional Tailwind. Button/select primitives also carry
  large strings, but their variants are centralized; page-level repeated cards,
  badges, tabs and empty/loading rows are not.
- **Why it feels off:** Visual changes are hard to make consistently and
  variant differences accumulate unnoticed. This is also the chief source of
  spacing/type drift in the product.
- **Suggested direction:** Extract feature cards/section components and use
  `cn()`/cva variants for recurring status chips, segmented controls, metric
  cards and tool-header actions. Do not over-abstract one-off chart markup.
- **Effort:** L

### UI-9 — Spacing and typography use many arbitrary, non-token values

- **Reference:** `src/app/chart/page.jsx:2892` (`mt-[5px]`), `4329`
  (`max-w-[900px]` outside the documented 768/1400 content widths), and
  `4240,4323,4371` (repeated 380/500px chart sizes); 
  `src/app/portfolio-tracker/page.jsx:1117-1128,1216,1246`
  (92/132/44px); `src/components/mobile-bottom-nav.jsx:78` (300px).
- **What is wrong:** Important layout numbers are ad hoc and repeated rather
  than expressed as shared component dimensions or the documented content
  widths/padding scale.
- **Why it feels off:** Near-identical elements no longer align exactly across
  loading, loaded, mobile and desktop states; arbitrary `text-[9px]`/`[10px]`
  usage throughout chart/portfolio also makes hierarchy overly dense.
- **Suggested direction:** Promote genuinely recurring chart/nav/mini-chart
  dimensions to component constants/variants, use normal spacing steps for
  one-off offsets, and consolidate a readable small-text scale.
- **Effort:** M

### UI-10 — Some visual treatments contradict the restrained monochrome identity

- **Reference:** `src/app/chart/page.jsx:51-116` (five-color analyst gauge);
  `src/app/idx-rotation/page.jsx:200-295,344-352` (four colored quadrant
  backgrounds plus dot glow); `src/components/desktop-navbar.jsx:111`
  (`shadow-2xl shadow-black/40`).
- **What is wrong:** The UI architecture specifies a monochrome palette with a
  sparing blue accent. These surfaces layer saturated red/orange/yellow/green,
  blue, and a heavy black dropdown shadow.
- **Why it feels off:** Semantic market color can be useful, but this density of
  colored zones/glow competes with the stated terminal-like visual language;
  the heavy dropdown shadow is disproportionate to otherwise low-elevation
  cards.
- **Suggested direction:** Keep semantic gain/loss color only where it conveys
  information, reduce decorative saturation/glow, and use the tokenized border
  plus a softer elevation for the tools menu.
- **Effort:** M

### UI-11 — Loading treatment has a quality mismatch inside an otherwise skeleton-led app

- **Reference:** `src/app/portfolio-tracker/page.jsx:1245-1249` and
  `src/app/chart/page.jsx:4323-4325,4366-4368`; compare the detailed skeletons
  at `portfolio-tracker/page.jsx:1109-1170` and `chart/page.jsx:4240,4551`.
- **What is wrong:** Mini-chart and normal-chart loading falls back to centered
  spinners/text, although the page already establishes fixed chart dimensions
  and uses shape-matched skeletons elsewhere.
- **Why it feels off:** Replacing a reserved data visualization with a spinner
  creates a harsh visual state change and makes the UI appear less finished.
- **Suggested direction:** Use the existing chart-sized skeleton convention for
  each chart state, retaining spinner only as a small supplementary cue.
- **Effort:** S

## Cross-audit priorities

Ordered for visible impact relative to effort:

1. **UI-3 / UI-4 (S):** Apply safe-area offsets to the mobile bottom nav and
   full-screen tool headers; this immediately improves installed-PWA ergonomics.
2. **UI-1 / UI-11 (S-M):** Replace full-screen and chart spinners with
   layout-matched skeletons to remove the most conspicuous loading flashes.
3. **TD-3 / TD-4 / TD-5 (M):** Centralize logo caching, symbol/price access,
   and formatters; this removes active duplication with limited surface change.
4. **TD-7 / TD-8 (M):** Resolve effect and render-purity lint failures before
   they become user-visible stale state or bubble jitter.
5. **UI-5 (M):** Make the existing motion tokens the shared timing policy for
   nav, sidebars, and data replacements.
6. **UI-6 / UI-7 (S-M):** Improve mobile tool target sizes and rework the fixed
   300px icon-only bottom-nav pill for the documented tablet/mobile range.
7. **TD-1 (L):** Decompose the chart route first; it is the largest maintain-
   ability and consistency risk.
8. **TD-2 / UI-8 (L):** Split portfolio/explore presentation and state into
   feature components and hooks after the shared primitives are established.

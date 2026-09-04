---
name: pwa-native-feel
description: Patterns for making Aruna's installed PWA feel native on mobile — safe-area handling, viewport-fit, standalone-mode transitions. Use when working on manifest.json, layout.jsx viewport config, or any fixed/sticky mobile chrome.
---

# PWA native-feel for Aruna

## The one verified gap: viewport-fit

`src/app/layout.jsx` exports:

```js
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};
```

There is no `viewportFit: 'cover'`. Without it, the meta viewport tag lacks `viewport-fit=cover`, and iOS Safari/standalone will not populate `env(safe-area-inset-*)` — they resolve to `0px` instead of the actual notch/home-indicator inset. `globals.css` (`.pb-safe`) and `src/app/discussion/page.jsx` both already write `env(safe-area-inset-bottom)` expecting it to work. Adding `viewportFit: 'cover'` to the viewport export is the single highest-leverage change for native feel — it's what makes every other safe-area rule in the codebase actually take effect.

## Safe-area checklist once viewport-fit is fixed

Audit every fixed/sticky element that sits at a screen edge in standalone mode:

- `mobile-bottom-nav.jsx` — bottom tab bar, needs `padding-bottom: env(safe-area-inset-bottom)` (or the existing `.pb-safe` utility) so tabs aren't under the home indicator.
- Mobile header (in `app-layout-client.jsx` or wherever the sticky top bar lives) — needs `padding-top: env(safe-area-inset-top)` for the status bar / notch.
- `discussion/page.jsx` input bar — already handled (`max(0.75rem, env(safe-area-inset-bottom))`), use as the reference pattern for the others.
- Any full-screen modal/sheet (`pwa-install-dialog.jsx`, `manage-watchlist-dialog.jsx`) that docks to an edge.

Pattern to reuse (matches the existing `.pb-safe` in `globals.css`):
```css
@supports (padding: max(0px)) {
  .pt-safe { padding-top: max(0.5rem, env(safe-area-inset-top)); }
}
```

## Manifest — remember it's a Route Handler, not a static file

`src/app/manifest.json/route.js` generates the manifest dynamically at request time (reads `NEXT_PUBLIC_APP_NAME`/`NEXT_PUBLIC_APP_VERSION`). It is not `public/manifest.json` and not the Next.js `app/manifest.js` metadata convention — don't create either of those, they'd conflict. `display: 'standalone'` + `display_override: ['standalone', 'minimal-ui', 'browser']` and `launch_handler.client_mode: 'auto'` are already set for native-feeling launch behavior. `shortcuts[]` covers the 5 main tools — keep it in sync if top-level routes change.

## Standalone-mode transition feel

- No view-transition API usage currently. For a more native feel between route changes in standalone mode, apply the existing `.fade-in` (from `micro-animation` skill / `globals.css`) to page content on mount rather than adding a new transition system.
- `scroll-behavior: smooth` is already global (`globals.css` `html` rule) — don't add a duplicate smooth-scroll polyfill.

## Service worker discipline

Any change to caching behavior in `public/sw.js` requires bumping `const VERSION` (currently `'1.8.0'`, line 1) — stale service workers otherwise keep serving old cached app shells indefinitely after a deploy, since `activate` only purges caches not in `KNOWN_CACHES` for the *new* version string. This is a hard rule from `OPENCODE.md`, not a suggestion.

## What NOT to do

- Don't add Workbox, `next-pwa`, or any SW-generation library — `public/sw.js` is hand-rolled and intentionally small (151 lines); extend the existing `networkFirst`/`staleWhileRevalidate` helpers instead of replacing the file's structure.
- Don't silently flip `userScalable: false` to `true` — pinch-zoom-disabled is common for app-feel but is an accessibility tradeoff; treat it as a decision needing explicit user confirmation, not a bug to auto-fix.
- Don't add `viewportFit: 'cover'` without also auditing safe-area coverage in the same change — turning it on with incomplete padding can expose unpadded content under the notch/home-indicator where before it was merely inert.

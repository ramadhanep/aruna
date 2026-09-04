---
name: micro-animation
description: Subtle, natural microinteraction and transition principles for Aruna, using only the existing CSS-based motion system (no animation libraries). Use when adding hover/focus states, loading transitions, or smoothing abrupt UI state changes.
---

# Micro-animation for Aruna

`framer-motion` was deliberately removed from this codebase (see commit "consolidate ticker row/dialog components, drop framer-motion"). All motion goes through plain CSS: Tailwind transition utilities, `tw-animate-css`, or hand-written keyframes in `src/app/globals.css`. Do not reintroduce a JS animation library.

## Existing primitives — reuse before inventing

Defined in `globals.css`:

- `.fade-in` — `fadeIn` keyframe, `translateY(6px)→0` + opacity, `0.4s cubic-bezier(0.4, 0, 0.2, 1)`. Use for content that appears (new list items, revealed panels).
- `.card-hover` — `transform: scale(1.01)` on hover, `transition: transform .18s ease-out, border-color .18s ease-out, background-color .18s ease-out`. Use for interactive card/row hover states.
- `.shimmer` / `.shimmer::after` — `shimmer-slide` keyframe, `1.6s ease-in-out infinite`. Use for loading placeholders, not for anything else.
- `.animate-marquee` — continuous scroll, duration via `--marquee-duration` custom property.
- Body-level `transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease` already smooths theme switches — don't add a redundant transition for theme toggles.

## Timing and easing rules for anything new

- **Hover/press feedback**: 150-200ms, `ease-out`. Matches `.card-hover`'s 180ms.
- **Content appearing/entering**: 300-400ms, `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind's default "ease" curve, matches `.fade-in`). Don't go past ~400ms — it starts to feel sluggish on mobile.
- **Nothing bouncy or springy.** No `cubic-bezier` overshoot curves, no `scale` beyond 1.01-1.02 for hover. The existing system is restrained — a new animation that "pops" more than `.card-hover` breaks visual consistency.
- **Respect `prefers-reduced-motion`**: if adding a new keyframe animation (not just a transition), wrap it in `@media (prefers-reduced-motion: no-preference)` or provide a static fallback — the existing `.fade-in`/`.shimmer` don't currently do this, so don't propagate the gap into new work; fix it locally when you touch a component that uses one.

## Where motion is currently thin

- Tab/route switches inside a page (e.g. switching chart timeframes, switching screener categories) mostly snap instantly — a `.fade-in` on the content container when the active tab/data changes is a safe, cheap win.
- Dialogs (Radix `dialog.jsx`, `sheet.jsx`) get Radix's built-in open/close state but check whether `tw-animate-css` classes are actually applied on the content — Radix only provides the state, not the animation.
- List reordering (watchlist drag reorder, portfolio entries) has no transition on position change — adding a `transition: transform` on the reordering container (not a library) is enough for a "settling" feel.

## What NOT to do

- No new dependency for animation, ever — this was a deliberate removal, not an oversight.
- No animating `width`/`height`/`top`/`left` (layout thrash) — animate `transform`/`opacity` only.
- No animation longer than ~400ms outside of the shimmer loop and marquee (which are intentionally continuous/slow).

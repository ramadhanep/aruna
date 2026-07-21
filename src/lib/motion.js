/**
 * Motion primitives — shared animation tokens for this app.
 *
 * CSS-only, built on native CSS transitions + tw-animate-css's `animate-in`
 * utilities (already imported in globals.css and used by every shadcn/ui
 * primitive: dialog, sheet, select, dropdown-menu, tooltip). No framer-motion —
 * it's an unused dependency, not the established convention here.
 *
 * When to use which:
 * - DURATION.fast (150ms) — micro-interactions: hover, toggle, icon swap.
 * - DURATION.base (250ms) — default: content appearing, skeleton→data swap.
 * - DURATION.slow (400ms) — larger surfaces: full page/section content reveal.
 *
 * - EASE.out — anything entering/appearing (the default direction).
 * - EASE.in  — anything leaving/dismissing.
 *
 * - MOTION.fadeIn  — plain fade, for content replacing a skeleton or a block
 *                     appearing with no directional motion.
 * - MOTION.slideUp — fade + rise from below, for list/card items appearing
 *                     in a list (each item gets its own instance via key).
 * - MOTION.scaleIn — fade + scale from 95%, for modals/popovers that are NOT
 *                     already Radix-driven (Dialog/Sheet/Select/Tooltip
 *                     animate via data-state already — don't double up).
 *
 * Apply as a className via cn(), e.g.:
 *   <div className={cn("rounded-xl", MOTION.fadeIn)}>
 *
 * Don't hardcode new durations/eases elsewhere — extend this file instead.
 */

export const DURATION = {
  fast: 150,
  base: 250,
  slow: 400,
};

// Matches Tailwind v4's built-in --ease-out / --ease-in values.
export const EASE = {
  out: "cubic-bezier(0, 0, 0.2, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
};

export const MOTION = {
  fadeIn: `animate-in fade-in-0 duration-[${DURATION.base}ms] ease-out`,
  slideUp: `animate-in fade-in-0 slide-in-from-bottom-2 duration-[${DURATION.base}ms] ease-out`,
  scaleIn: `animate-in fade-in-0 zoom-in-95 duration-[${DURATION.fast}ms] ease-out`,
};

---
name: tailwind-cleanup
description: Consolidate Tailwind class sprawl in Aruna components into shared patterns, respecting the existing Tailwind v4 config and shadcn/ui primitives. Use when cleaning up duplicated className strings, extracting repeated card/row/dialog patterns, or normalizing spacing.
---

# Tailwind cleanup for Aruna

Aruna uses Tailwind v4 (`@tailwindcss/postcss`, config-free — theme lives in `src/app/globals.css`'s `@theme inline` block, not a `tailwind.config.js`). `class-variance-authority` (cva) + `clsx`/`tailwind-merge` via `cn()` in `@/lib/utils` are the established variant/merge tools. `components.json` configures shadcn/ui codegen conventions.

## Before extracting anything

1. Check `src/components/ui/*` first. If the pattern you're about to extract is a variant of an existing primitive (`card.jsx`, `button.jsx`, `dialog.jsx`, `sheet.jsx`, `skeleton.jsx`), extend that primitive's `cva` variants rather than creating a new component.
2. Check whether the pattern already has a name in the codebase — e.g. `ticker-row.jsx` + `ticker-row-skeleton.jsx` were already consolidated once (see commit "consolidate ticker row/dialog components"). Don't re-fragment something that was just unified.
3. Grep for the exact duplicated class string before assuming it's duplicated — `tailwind-merge`'s `cn()` already resolves conflicting classes at runtime, so two components with slightly different class lists may be intentionally different, not sprawl.

## What "cleanup" means here

- **Duplication → shared component**: if 3+ places hand-roll the same div structure (e.g. a card with logo + name + price + change%), extract one component that takes props, not a growing set of copy-pasted JSX blocks.
- **Duplication → cva variant**: if the structure is identical but only a few classes differ (color, size, padding), that's a `cva` variant on the existing primitive, not a new component.
- **Long inline class strings → composed via `cn()`**: break a 15+ class string into logical groups (layout, spacing, color, state) passed through `cn()`, so diffs are readable and conditional classes are clear.
- **Spacing normalization**: per `docs/ui-architecture.md`, mobile content uses `p-4`, desktop `p-6`; max-width `768px` mobile / `1400px` desktop. When you find an outlier (`p-3.5`, `p-5`, a bespoke max-width), normalize to the documented convention unless there's a visible reason not to (e.g. a modal that's intentionally tighter).

## What NOT to do

- Don't introduce a CSS-in-JS or CSS Modules pattern — `docs/ui-architecture.md` is explicit: "No CSS modules, styled-components, or CSS-in-JS."
- Don't add a new className-merging or variant library — `cn()` + `cva` already cover it.
- Don't touch the `@theme inline` token block in `globals.css` as part of a "cleanup" — token changes are a design decision, not a cleanup, and need explicit sign-off.
- Don't extract a shared component for something used in only one or two places — that's premature abstraction, not cleanup. Three or more real call sites is the bar.

## Verify

After any extraction, grep for the old inline pattern across `src/components` and `src/app` to confirm every call site was migrated, then run `npm run lint`.

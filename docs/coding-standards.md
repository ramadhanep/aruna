# Coding Standards

## Naming

| Concept | Convention | Example |
|---|---|---|
| Files/Directories | `kebab-case` | `money-flow-card.jsx`, `auth-provider.jsx` |
| React components | `PascalCase` | `MoneyFlowCard`, `AuthProvider` |
| Functions | `camelCase` | `fetchEncodedJson`, `formatMarketCap` |
| Variables | `camelCase` | `user`, `remoteWatchlist` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_WATCHLIST`, `MSCI_THRESHOLDS` |
| CSS classes | `kebab-case` | `card-hover`, `hide-scrollbar` |
| Environment variables | `UPPER_SNAKE_CASE` | `NEXT_PUBLIC_SUPABASE_URL` |
| Supabase tables | `snake_case` | `screening_snapshots`, `money_flow_reports` |
| API routes | `kebab-case` | `/api/money-flow`, `/api/delete-account` |

## Component Organization

```
// 1. Imports — external first, then internal
// 2. Component definition with "use client" if needed
// 3. Props destructuring in function signature
// 4. Hooks at top
// 5. Callbacks and memoized values
// 6. Effects
// 7. Render (JSX)
// 8. Exported as default
```

## Function Style

- Use `function` keyword for component definitions.
- Use `const` + arrow functions for callbacks and utilities.
- `async/await` for asynchronous operations.
- Default exports for page components and route handlers.

## Error Handling

- API routes: Return `Response.json()` with appropriate status codes.
- Client-side: Use try/catch with `console.warn` for non-critical errors.
- Network errors: Show error states via `AlertTriangle` or inline error messages.
- Global error boundaries exist: `src/app/error.jsx` (route-level) and
  `src/app/global-error.jsx` (root-level) render an in-app retry screen
  instead of a blank page.

## Async Patterns

- `fetchEncodedJson()` for all API calls — handles XOR decoding automatically.
- `promisePool()` for concurrency-limited batch operations (used in `/api/quotes`).
- Supabase operations use `await` directly with try/catch.

## Effect Patterns

- **External subscriptions** (resize, auth state, media queries) use
  `useSyncExternalStore` when the subscribed value is read during render
  (`use-mobile.js`), or `useEffect` with cleanup for imperative subscriptions
  (`auth-provider.jsx` `onAuthStateChange`).
- **Data fetching** in effects uses an async IIFE with a `cancelled` boolean
  guard returned from the cleanup function. State updates (`setState`) after
  `await` boundaries are safe.
- **Hydration guards** (client-only booleans) use `useSyncExternalStore` with
  `() => true` (client) / `() => false` (SSR) snapshots, or `useState` lazy
  initializers with a `typeof window === "undefined"` guard for localStorage
  reads.
- **Dialog/event-driven state** (reset form on close, initialize on open) lives
  in event handlers, not effects.
- **Avoid** `setState` calls that execute synchronously in the effect body
  (before any `await`). Use `queueMicrotask` or `setTimeout(fn, 0)` to defer
  when a synchronous `setState` is unavoidable at the start of an async
  operation (e.g., `setLoading(true)` before a fetch).
- **Cancellation:** For async work in effects, always maintain a `cancelled`
  flag. For stale-request protection, use a monotonically incrementing
  `requestId` ref and check it after await.

## Logging

- `console.warn()` for expected failures (network issues, missing data).
- `console.error()` for unexpected failures.
- Dev-only logging via `writeYahooRawLog()` for Yahoo Finance API debugging.
- No structured logging library.

## Import Conventions

- Use `@/` path alias for all internal imports.
- External packages imported by name.
- CSS imports only in `globals.css` and `layout.jsx`.
- Dynamic imports for `lightweight-charts` (large ESM module).

```jsx
// Good
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';

// Avoid
import { cn } from '../../lib/utils';
```

## Code Style Rules

- Semicolons are used throughout — not omitted (verified: `auth-provider.jsx`, `utils.js`, `discussions/route.js` all use them consistently).
- Quote style is mixed, not a strict single-quote convention — both `'...'` and `"..."` appear across files (and within the same file, e.g. `utils.js`). No enforced rule; match the surrounding file when editing.
- Trailing commas in multiline objects/arrays.
- 2-space indentation.
- JSX uses parentheses for multiline return statements.
- Class name merging via `cn()` utility (clsx + tailwind-merge).
- No ESLint stylistic rule enforces any of the above — `eslint.config.mjs` only pulls in `eslint-config-next`. These are observed conventions, not linted rules.

## Dependency Rules

- No dependency on a state management library (Redux, Zustand, etc.) — React Context + localStorage only.
- No new UI framework — Radix UI + Tailwind only.
- No new charting library without evaluation against current stack.
- Prefer native browser APIs over npm packages when feasible.

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
- No global error boundary is configured.

## Async Patterns

- `fetchEncodedJson()` for all API calls — handles XOR decoding automatically.
- `promisePool()` for concurrency-limited batch operations (used in `/api/quotes`).
- Supabase operations use `await` directly with try/catch.

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

- No semicolons (standard in this codebase).
- Single quotes for strings.
- Trailing commas in multiline objects/arrays.
- 2-space indentation.
- JSX uses parentheses for multiline return statements.
- Class name merging via `cn()` utility (clsx + tailwind-merge).

## Dependency Rules

- No dependency on a state management library (Redux, Zustand, etc.) — React Context + localStorage only.
- No new UI framework — Radix UI + Tailwind only.
- No new charting library without evaluation against current stack.
- Prefer native browser APIs over npm packages when feasible.

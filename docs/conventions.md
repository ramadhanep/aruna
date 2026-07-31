# Conventions

## Component Conventions

- **UI primitives** live in `src/components/ui/` and are generated/modified via shadcn/ui patterns.
- **Feature components** live in `src/components/` and are named after their purpose.
- Components use `data-slot` attributes for styling hooks (shadcn convention).
- `"use client"` directive at the top of any file using browser APIs, React hooks, or event handlers.
- Server components are the default — only add `"use client"` when necessary.

## Avoiding `useSearchParams` Without `<Suspense>`

Any component using `useSearchParams()` must be wrapped in `<Suspense>` at the parent level (see `account-sidebar.jsx` for pattern).

## Auth Provider Conventions

- `useAuth()` hook provides: `user`, `session`, `loading`, `supabaseConfigured`, `signInWithGoogle`, `signOut`, `syncWatchlist`, `syncPortfolio`, `refreshRemoteWatchlist`, `refreshRemotePortfolio`, `clearRemoteData`, `deleteAccount`.
- Session storage key: `aruna_auth` (in localStorage).
- Profile upsert on sign-in automatically.
- Watchlist/portfolio sync: local-first, remote on write.

## API Route Conventions

All API routes follow this pattern:

```js
import { encodePayload } from '@/lib/secure-payload';

export async function GET(request) {
  try {
    // 1. Parse params
    // 2. Validate input
    // 3. Fetch data
    // 4. Return encoded response
    return Response.json({ payload: encodePayload({ data: result }) });
  } catch (error) {
    return Response.json(
      { payload: encodePayload({ error: error.message }) },
      { status: 500 }
    );
  }
}
```

Exceptions (no XOR encoding):
- `/api/cron/*` — plain JSON for cron job responses.

`/api/discussions` is NOT an exception — its GET/POST/DELETE all use `encodePayload()` like every other data route.

## XOR Payload Convention

- Server: `encodePayload(data)` from `@/lib/secure-payload`.
- Client: `fetchEncodedJson(url)` from `@/lib/api-client` which calls `decodeApiResponse(body)`.
- All responses wrapped in `{ payload: "<base64-encoded-xor>" }`.
- Decoded response access: `const { response, data } = await fetchEncodedJson(url)`.

## Supabase Client Conventions

| Usage | Client | File |
|---|---|---|
| Browser (auth, RLS) | `getSupabaseBrowserClient()` | `supabase-browser.js` |
| Server/API (service role) | `getSupabaseServiceRoleClient()` | `supabase-server.js` |
| Get user from request | `getUserFromRequest(request)` | `supabase-server.js` |

## Local Storage Keys

| Key | Purpose |
|---|---|
| `aruna_auth` | Supabase session persistence |
| `aruna-theme` | Theme preference (dark/light/system) |
| `aruna-watchlist` | Local watchlist (guest mode) |
| `aruna-portfolio` | Local portfolio (guest mode) |
| `aruna_header_symbol_history` | Recent symbol search history |
| `aruna-trial-state` | Trial `{ startedAt, expiresAt }` state (60-minute guest trial) |
| `sidebar_state` | Sidebar collapsed/expanded |

Portfolio persistence is centralized in `src/lib/portfolio-storage.js`. Legacy keys (`portfolio_currency`, `portfolio_visibility_hidden`, `aruna_guest_portfolio`, `aruna_guest_portfolio_seeded`) are migrated to `aruna-portfolio` on first load and no longer read directly by components.

## CSS Conventions

- Tailwind v4 with `@theme inline` for design tokens.
- CSS variables in `:root` and `.dark` for theming — plain hex values (e.g. `--background: #f7f7f3`), not `oklch()`.
- Custom animations defined as `@keyframes` in `globals.css`.
- No CSS modules — Tailwind only.
- `!important` overrides for third-party widget styling (e.g., `#tv-attr-logo`).

## Design Tokens and Motion

- Tiny type scale: `text-2xs` (10px) and `text-3xs` (9px) theme tokens replace
  `text-[10px]`/`text-[9px]` — use them for dense metadata; don't introduce new
  arbitrary font sizes.
- `src/lib/motion.js` is the single timing policy. Custom (non-Radix) surfaces
  use `DURATION_CLASS` (`fast`/`base`/`slow`) for transition durations; never
  hardcode new `duration-*` values. Radix primitives animate via `data-state`
  and must not be double-animated.
- Loading states reserve the final layout: shape-matched `Skeleton` blocks or
  `ScatterSkeleton` (full-screen dot-field for the two visualization tools).
  Avoid whole-screen/centered `Loader2` as an initial state.
- Repeated page-local dimensions get a named constant (e.g. `CHART_HEIGHT_CLASS`,
  `CURRENCY_SELECT_WIDTH`) rather than repeated literals.

## File Naming

| Type | Convention |
|---|---|
| Page files | `page.jsx` (Next.js convention) |
| Route handlers | `route.js` (Next.js convention) |
| Layout files | `layout.jsx` (Next.js convention) |
| UI components | `kebab-case.jsx` (e.g., `money-flow-card.jsx`) |
| Library modules | `kebab-case.js` (e.g., `msci-calculations.js`) |
| Hooks | `use-kebab-case.js` (e.g., `use-mobile.js`) |

## Type/Interface Conventions

The project uses **JavaScript** (no TypeScript). Data shapes are documented implicitly through usage. Key patterns:

- Supabase table types: defined by SQL schema in `supabase/setup.sql`.
- API response shapes: documented in `aruna-api.json` (Bruno/Postman collection).
- Formatters: `formatPrice`, `formatMarketCap`, `formatPercent`, `formatCompactNumber`, `formatDecimalPercent`, `formatUSD`, `formatIDR`, `formatSGD`, `formatByCurrency` in `lib/utils.js`.
- Shared responsive/date constants: `MOBILE_BREAKPOINT` (1024), `RECENT_PRICE_LOOKBACK_DAYS` (5), `getRecentUnixRange()` in `lib/time.js`.
- No JSDoc annotations.

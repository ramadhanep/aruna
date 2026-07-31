# Application Flow

## Startup Sequence

1. User hits `https://aruna.app/` (or any route).
2. Next.js server renders `src/app/layout.jsx` — root layout.
3. Provider hierarchy initializes:
   - `ThemeProvider` (next-themes) — reads `aruna-theme` from localStorage, applies dark/light class.
   - `AuthProvider` — checks existing Supabase session in `aruna_auth` localStorage key, subscribes to `onAuthStateChange`.
   - `TrialProvider` — checks trial expiry from localStorage.
   - `AppearanceModeProvider` — checks `aruna-appearance-mode`.
   - `PWARegister` — registers service worker if not already.
   - `PWAInstallDialog` — shows install prompt if criteria met.
   - `TrialGuard` — blocks content if trial expired.
   - `AppLayoutClient` — renders navigation chrome and content.

4. Root page (`src/app/page.jsx`) redirects to `/explore`.

## Request Lifecycle (API)

```
Browser ──GET /api/finance?symbol=BBCA.JK──► Next.js Route Handler
                                                    │
                                          ┌─────────┴─────────┐
                                          │  proxy.js           │
                                          │  - CORS headers    │
                                          │  - Allowed origins │
                                          │  - Screener rate   │
                                          │    limit (429)     │
                                          └─────────┬─────────┘
                                                    │
                                          ┌─────────┴─────────┐
                                          │  Route Handler    │
                                          │  - Parse params   │
                                          │  - Validate input │
                                          │  - Fetch data     │
                                          └─────────┬─────────┘
                                                    │
                                          ┌─────────┴─────────┐
                                          │  yahoo-finance2   │
                                          │  or Supabase      │
                                          └─────────┬─────────┘
                                                    │
                                          ┌─────────┴─────────┐
                                          │  encodePayload()  │
                                          │  (XOR cipher)     │
                                          └─────────┬─────────┘
                                                    │
                              ◄──── { payload: "..." } ────
                                                    │
Browser ──fetchEncodedJson()──► decodeApiResponse() ──► data
```

## User Interaction Flow

### Guest User
1. Visits `/explore` — sees market overview, trending stocks, screener results.
2. `/watchlist` — default watchlist (12 popular symbols).
3. `/chart` — can view seasonal charts and fundamentals.
4. `/portfolio-tracker` — local-only, stored in localStorage.
5. Money flow, momentum, MSCI — limited preview (5 items max, then lock UI).
6. `/discussion` — read-only.

### Authenticated User
Same as guest, plus:
- Watchlist synced to Supabase `watchlists` table.
- Portfolio synced to Supabase `portfolios` table.
- No feature locks on money flow, momentum, MSCI.
- Can post in `/discussion`.
- Can delete account via `account-sidebar.jsx`.

### First-Time Visitor (no trial)
1. Navigates to protected route.
2. `AppLayoutClient` checks: no user, no trial.
3. Redirects to `/signin?redirect=<original-path>`.
4. Signs in with Google OAuth.
5. Callback lands on `/account?redirect=<original-path>`.
6. `account/page.jsx` redirects to original path (or `/portfolio-tracker`).

## Data Flow

### Yahoo Finance Data
```
Browser ──fetchEncodedJson("/api/finance?symbol=...")──► Route Handler
                                                              │
                                                    yahooFinance.chart()
                                                              │
                                                  encodePayload(result)
                                                              │
Browser ◄── { payload: "..." } ◄── decodeApiResponse() ◄────┘
```

### Supabase Data (User-owned)
```
Browser ──supabase.from("watchlists").select()──► Supabase RLS
                                                      │
                                              user_id = auth.uid()
                                                      │
Browser ◄── items[] ◄──────────────────────────────────┘
```

### Cron Job Flow
```
Vercel Cron ──GET /api/cron/idx──► Route Handler
                    │                        │
              Bearer Token            Run Screener Logic
              Validation               (yahoo-finance2)
                    │                        │
                    └────── Store in screening_snapshots ──────► Supabase
```

## Error Flow

- **API errors**: Returned as `{ payload: encodePayload({ error: "message" }) }` with appropriate HTTP status.
- **Network failures**: Client-side components show loading states, then inline error messages.
- **Authentication failures**: Redirect to `/signin`.
- **Trial expired**: Redirect to `/pricing`.
- **404 page**: Custom `not-found.jsx` with navigation options.

## Loading Flow

- **API calls**: Pages use `useState` + `useEffect` pattern. Loading state shows skeleton or spinner.
- **Auth state**: `AuthProvider.loading` flag. Protected routes show spinner while checking session.
- **Supabase queries**: Direct async/await with loading states managed per-page.
- **Dynamic imports**: `lightweight-charts` loaded via dynamic `import()` to reduce initial bundle.

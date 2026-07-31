# Authentication

## Provider

- **Supabase Auth** with **Google OAuth** as the only provider.

## Client-Side Auth

- **Supabase client**: Singleton via `getSupabaseBrowserClient()` in `lib/supabase-browser.js`.
- **Session persistence**: `localStorage` key `aruna_auth`.
- **Auth state**: `AuthProvider` context subscribes to `supabase.auth.onAuthStateChange()`.
- **Sign-in flow**: `signInWithGoogle()` calls `supabase.auth.signInWithOAuth({ provider: "google" })`.

## Server-Side Auth

Two patterns coexist:

- **Bearer-token** (most routes): `getSupabaseServiceRoleClient()` in `lib/supabase-server.js` uses `SUPABASE_SERVICE_ROLE_KEY` for privileged access. `getUserFromRequest(request)` extracts `Authorization: Bearer <token>` and validates via `supabase.auth.getUser(token)`. Used by `/api/delete-account` and (with `CRON_SECRET` instead of a user token) `/api/cron/*`.
- **Cookie-session** (`/api/discussions` POST/DELETE only): `createServerClient()` from `@supabase/ssr` reads/writes the Supabase auth session via `cookies()` (`next/headers`), then calls `supabase.auth.getUser()` with no token argument — the session comes from the cookie, not a header.

## OAuth Flow

```
1. User clicks "Sign in with Google"
2. supabase.auth.signInWithOAuth({ provider: "google", redirectTo: "/account" })
3. Browser redirects to Google consent screen
4. Google redirects to /account?redirect=<original-path>
5. account/page.jsx immediately redirects to original path
6. AuthProvider detects new session via onAuthStateChange
7. Profile is upserted to Supabase profiles table
8. Watchlist and portfolio are synced from localStorage to Supabase
```

## Post-Sign-In Sync

After sign-in, `AuthProvider`:
1. Upserts profile row in `profiles` table.
2. Fetches `watchlists` and `portfolios` from Supabase.
3. If user previously had local data, the local data is preserved (remote overwrites only on explicit sync).
4. Posts a system message in discussions if first sign-in: `"<Name> joins Aruna"`.

## Sign-Out Flow

1. Calls `supabase.auth.signOut()`.
2. Clears remote watchlist/portfolio from context state.
3. Prompts for confirmation via dialog.

## Environment Variables Required

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |

## Security Considerations

- No server-side route protection — proxy only applies CORS (plus a per-IP rate limit on `/api/screeners`).
- Protected routes check auth state client-side in `AppLayoutClient`.
- API-level auth: cron and delete-account use Bearer-token checks; `/api/discussions` POST/DELETE use a cookie-based Supabase session instead (see Server-Side Auth above).
- Supabase RLS policies protect user-owned tables.
- XOR cipher is **not cryptography** — obfuscation only.
- Google OAuth `access_type=offline` and `prompt=consent` are requested.

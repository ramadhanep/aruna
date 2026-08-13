# Authorization

## Roles

There are **two roles** in the system:

| Role | Description |
|---|---|
| Guest | Unauthenticated user. Limited feature access. |
| Authenticated | Signed in via Google OAuth. Full feature access. |

No admin, moderator, or multi-role system exists.

## Access Control Mechanism

### 1. Client-Level Feature Locking

All routes are browsable without authentication. Certain features are locked/blurred
for unauthenticated users; sign-in is only required for write actions (e.g. syncing
watchlist/portfolio, posting discussions).

### 2. Feature-Level Locking

Certain features are blurred/locked for unauthenticated users:

- **Money flow details**: Lock icon overlay on detailed reports.
- **MSCI tracker**: Only 5 items visible, then blur.
- **Momentum scanner**: Only 5 items visible, then blur.
- **Earnings/revenue charts**: Locked in chart page.

### 3. API-Level Authorization

| Route | Auth Required | Mechanism |
|---|---|---|
| `/api/cron/*` | CRON_SECRET | Bearer token check |
| `/api/delete-account` | User session | Bearer token → `getUserFromRequest()` |
| `/api/discussions` (POST, DELETE) | User session | Cookie session — `createServerClient()` (`@supabase/ssr`) reads the Supabase session cookie via `cookies()`, not a Bearer token |
| All other APIs | None | Public (data is obfuscated) |

Two distinct server-side auth mechanisms coexist in this codebase: Bearer-token (cron, delete-account) and cookie-session (discussions). Don't assume one covers all API routes.

### 4. Supabase RLS Policies

| Table | Policy |
|---|---|
| `profiles` | Owner only (user_id = auth.uid()) |
| `watchlists` | Owner only (user_id = auth.uid()) |
| `portfolios` | Owner only (user_id = auth.uid()) |
| `discussion_messages` | SELECT: public; INSERT: authenticated; DELETE: own messages |
| All other tables | Public read / service-role write |

### 5. CORS Enforcement (Middleware)

- CORS headers applied to `/api/*` routes.
- Allowed origins derived from env vars (`API_ALLOWED_ORIGINS`, `APP_URL`, `VERCEL_URL`).
- **Currently**: Strict origin blocking is commented out — CORS configuration is decorative.

## Future Considerations

- Subscription-based feature gating (not implemented; `/pricing` was removed).
- Rate limiting for API routes (not implemented).

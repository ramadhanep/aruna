# Authorization

## Roles

There are **two roles** in the system:

| Role | Description |
|---|---|
| Guest | Unauthenticated user. Limited feature access. |
| Authenticated | Signed in via Google OAuth. Full feature access. |

No admin, moderator, or multi-role system exists.

## Access Control Mechanism

### 1. Client-Level Route Gating (`AppLayoutClient.jsx`)

```javascript
const PUBLIC_ROUTES = new Set(["/", "/signin", "/offline", "/pricing", "/explore"]);

// Protected routes redirect to /signin if:
// - Not authenticated AND no active trial
```

- `TrialProvider` manages trial state (stored in localStorage).
- `TrialGuard` wraps the app — blocks content if trial expired.
- `TrialBanner` shows expiry warning.

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
| `/api/discussions` (POST) | User session | Bearer token → Supabase Auth |
| All other APIs | None | Public (data is obfuscated) |

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

- Subscription-based feature gating (pricing page exists but not fully active).
- Rate limiting for API routes (not implemented).

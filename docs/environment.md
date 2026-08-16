# Environment

## Required Variables

| Variable | Required | Where Used | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Browser + server, all API routes | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Browser Supabase client, discussions API | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server API routes (screeners, bubbles, msci, discussions, cron, delete-account) | Never expose to browser |
| `APP_URL` | ✅ | `next.config.mjs` → `NEXT_PUBLIC_APP_URL`, proxy CORS | Production base URL |
| `SECURE_PAYLOAD_KEY` | ✅ | XOR cipher for API response obfuscation | Must match server and client |
| `CRON_SECRET` | ✅ | Cron endpoint bearer token auth | Used by Vercel cron scheduler |

## Optional Variables

| Variable | Default | Where Used | Notes |
|---|---|---|---|
| `STOCKBIT_AUTHORIZATION_BEARER` | — | Money flow cron (Stockbit API auth) | Bearer token from Stockbit session |
| `STOCKBIT_SCREENER_TEMPLATE_ID` | `"5461641"` | Money flow cron | Screener template ID on Stockbit |
| `MONEY_FLOW_ENABLED` | `true` | `/api/money-flow`, `/api/cron/money-flow` | Server-side feature flag; `false` makes the API return `404` and the cron no-op |
| `NEXT_PUBLIC_MONEY_FLOW_ENABLED` | `true` | Money Flow page, tools menu, manifest shortcuts | Client-side feature flag; `false` hides the Money Flow entry and page |
| `API_ALLOWED_ORIGINS` | — | Middleware CORS allowlist | Comma-separated origins |
| `VERCEL_URL` | Auto-set by Vercel | Middleware CORS, cron base URL | Automatically injected |
| `NEXT_PUBLIC_APP_NAME` | `"Aruna"` | Layout, manifest | Set via `next.config.mjs` |
| `NEXT_PUBLIC_APP_VERSION` | `"1.8.0"` | Account sidebar version display | Set via `next.config.mjs` |

## Configuration Loading

- Environment variables are loaded by Next.js from `.env.local` (development) or Vercel project settings (production).
- `next.config.mjs` exposes some server-only variables to the client via `env` block:
  - `NEXT_PUBLIC_APP_NAME`
  - `NEXT_PUBLIC_APP_VERSION`
  - `NEXT_PUBLIC_APP_URL`
  - `SECURE_PAYLOAD_KEY` (exposed to server-side API routes)

## Runtime Behavior

- `SECURE_PAYLOAD_KEY` is available to both server and client (via `next.config.mjs`).
- `SUPABASE_SERVICE_ROLE_KEY` is server-only, never exposed to the browser.
- `NODE_ENV` determines some behaviors:
  - `writeYahooRawLog()` only runs in non-production.
  - CORS allows `localhost:3000` only in non-production.

## Template

See `.env.template` in the project root for a complete list with placeholder values.

# Deployment

## Hosting

**Vercel** — serverless Next.js deployment.

## Build Process

```bash
npm run build    # next build
npm run start    # next start (production server)
```

Build output is a standard Next.js serverless bundle for Vercel deployment.

## CI/CD

Not configured. Deployment is manual via Vercel Git integration or `vercel` CLI.

## Vercel Configuration

**`vercel.json`** — currently `{}`. **Cron scheduling is intentionally disabled
(Phase 7 decision, 2026-07-31).** No automatic refresh runs; screener and
money-flow data stays stale until triggered manually. The historical schedule
below is recorded for reference only and is NOT live:

```json
{
  "crons": [
    {
      "path": "/api/cron/idx",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/us",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/crypto",
      "schedule": "0 4 * * *"
    }
  ]
}
```

> **Status (Phase 7):** scheduling is deliberately off. Re-enabling requires
> a product decision against current Vercel plan cron limits (Hobby: max 2
> daily). Users see manual-trigger behavior: the explore page runs screener
> batches on demand (rate-limited to 20/min/IP), and `/api/cron/money-flow`
> must be invoked manually with `CRON_SECRET`.

**`public/_headers`** — Vercel headers for service worker:

```
/sw.js
  Cache-Control: public, max-age=0, must-revalidate
  Service-Worker-Allowed: /
```

**Security headers** are applied to every response via `next.config.mjs`
`headers()`: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a
report-only CSP (`Content-Security-Policy-Report-Only`).

## Environment Variables on Vercel

All variables from `docs/environment.md` must be set in Vercel project settings. `VERCEL_URL` is auto-injected.

## Cron Jobs

Vercel cron triggers would be configured in `vercel.json` (currently empty —
**scheduling is disabled**, see Vercel Configuration above). If a schedule is
restored, each cron job:
1. Sends a GET request to the configured path.
2. Includes `Authorization: Bearer <CRON_SECRET>` header (Vercel injects this from the `CRON_SECRET` env var).

### Scheduled Jobs

**None configured.** `vercel.json` is `{}` by Phase 7 decision. The
historical table below is the candidate set if scheduling is ever restored:

| Path | Schedule (historical) | Description |
|---|---|---|
| `/api/cron/idx` | Daily 02:00 UTC | IDX EMA-31 momentum screener |
| `/api/cron/us` | Daily 03:00 UTC | US markets momentum screener |
| `/api/cron/crypto` | Daily 04:00 UTC | Crypto momentum screener |
| `/api/cron/money-flow` | Not scheduled in vercel.json | Stockbit money flow analysis (trigger manually or add schedule) |

## Health Checks

`GET /api/health` returns `{ "status": "ok", "timestamp": "<ISO>" }` — a
lightweight liveness probe for uptime monitors. Plain JSON (not XOR-encoded,
like the cron routes) so external monitors can read it. It intentionally does
not check external dependencies (Supabase, Yahoo, Stockbit).

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs `npm run lint` and
`npm run build` on push/PR with placeholder env vars (build-time values only;
runtime secrets stay in Vercel project settings).

## PWA Deployment Considerations

- Service worker at `public/sw.js` — `VERSION` must stay in sync with the app
  version in `package.json` (currently `1.8.0`) and be bumped on every cache
  strategy change.
- Manifest generated dynamically at `/manifest.json` (`src/app/manifest.json/route.js`).
- Offline fallback at `/offline`.
- App icons: `/aruna.png` at multiple resolutions.
- Update `public/sw.js` version when making PWA cache strategy changes.

## Domain

- Production: `https://aruna.app` (configurable via `APP_URL`).

## Monitoring

- No external monitoring/alerting platform (Sentry etc.) — intentionally out
  of scope for Phase 7.
- Structured JSON request logging: every Yahoo call is logged with `source:
  "yahoo"`, URL, status, and duration; cron runs log a summary line
  (`source: "cron-trigger"` / `"money-flow-cron"`) with status and counts.
- `GET /api/health` is the liveness probe for external uptime monitors.
- Cron job success/failure returned in HTTP response (no external notification).

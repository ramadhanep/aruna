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

**`vercel.json`** — currently `{}`. No cron schedule is configured. The historical
schedule below is NOT live and is recorded only as the pending Phase 7 decision:

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

> **Status (Phase 6):** `vercel.json` is intentionally empty. The schedule above
> is the previously-used configuration, retained for reference. Restoring it (or
> formally documenting scheduled refresh as disabled) is the pending Phase 7
> decision — see `docs/MAINTENANCE_PLAN.md` Phase 7. Do not treat the above as
> live configuration.

**`public/_headers`** — Vercel headers for service worker:

```
/sw.js
  Cache-Control: public, max-age=0, must-revalidate
  Service-Worker-Allowed: /
```

## Environment Variables on Vercel

All variables from `docs/environment.md` must be set in Vercel project settings. `VERCEL_URL` is auto-injected.

## Cron Jobs

Vercel cron triggers are configured in `vercel.json`. Each cron job:
1. Sends a GET request to the configured path.
2. Includes `Authorization: Bearer <CRON_SECRET>` header (Vercel injects this from the `CRON_SECRET` env var).

### Scheduled Jobs

**None configured.** `vercel.json` is `{}`. If Phase 7 restores a schedule, the
historical table below is the candidate set:

| Path | Schedule (historical) | Description |
|---|---|---|
| `/api/cron/idx` | Daily 02:00 UTC | IDX EMA-31 momentum screener |
| `/api/cron/us` | Daily 03:00 UTC | US markets momentum screener |
| `/api/cron/crypto` | Daily 04:00 UTC | Crypto momentum screener |
| `/api/cron/money-flow` | Not scheduled in vercel.json | Stockbit money flow analysis (trigger manually or add schedule) |

## PWA Deployment Considerations

- Service worker at `public/sw.js` has its own cache version (`VERSION = '1.3.42'`).
- Manifest generated dynamically at `/manifest.json` (`src/app/manifest.json/route.js`).
- Offline fallback at `/offline`.
- App icons: `/aruna.png` at multiple resolutions.
- Update `public/sw.js` version when making PWA cache strategy changes.

## Domain

- Production: `https://aruna.app` (configurable via `APP_URL`).

## Monitoring

- No monitoring/alerting configured.
- Yahoo Finance API failures logged to `console.error`.
- Cron job success/failure returned in HTTP response (no external notification).

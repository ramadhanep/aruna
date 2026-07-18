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

**`vercel.json`** — defines cron job schedules:

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

| Path | Schedule | Description |
|---|---|---|
| `/api/cron/idx` | Daily 02:00 UTC | IDX EMA-31 momentum screener |
| `/api/cron/us` | Daily 03:00 UTC | US markets momentum screener |
| `/api/cron/crypto` | Daily 04:00 UTC | Crypto momentum screener |
| `/api/cron/money-flow` | Not scheduled in vercel.json | Stockbit money flow analysis (trigger manually or add schedule) |

## PWA Deployment Considerations

- Service worker at `public/sw.js` has its own cache version (`VERSION = '1.3.42'`).
- Manifest generated dynamically at `/api/manifest.json`.
- Offline fallback at `/offline`.
- App icons: `/aruna.png` at multiple resolutions.
- Update `public/sw.js` version when making PWA cache strategy changes.

## Domain

- Production: `https://aruna.app` (configurable via `APP_URL`).

## Monitoring

- No monitoring/alerting configured.
- Yahoo Finance API failures logged to `console.error`.
- Cron job success/failure returned in HTTP response (no external notification).

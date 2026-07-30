# Known Issues

## Security

### XOR Cipher Is Not Cryptography
`lib/secure-payload.js` uses simple XOR with a repeating key. Anyone with the `SECURE_PAYLOAD_KEY` or who reverse-engineers the pattern can read all API responses. This is obfuscation only — not a substitute for HTTPS or signed JWTs.

### CORS Enforcement Is Partial
Strict origin blocking (`buildUnauthorizedResponse`) is commented out in `middleware.js`. The middleware applies CORS headers but doesn't block unauthorized origins. CORS is decorative, not protective.

### Stockbit API Scraping
The money flow cron (`/api/cron/money-flow`) authenticates to `https://exodus.stockbit.com` (a private/undocumented API) using a user bearer token. This is fragile and may violate Stockbit's ToS.

## Code Quality

### Hardcoded USD/IDR Exchange Rate
`lib/msci-calculations.js` hardcodes `USD_TO_IDR = 15_800`. Should fetch a live exchange rate.

### Money Flow Cron Truncates All Data
The money flow cron deletes all existing data before re-inserting: `supabase.from("money_flow_reports").delete().neq("id", 0)`. A failed cron run leaves the table empty.

### Hardcoded Screener Template ID
`DEFAULT_SCREENER_TEMPLATE_ID = "5461641"` is hardcoded in the money flow cron. The env var `STOCKBIT_SCREENER_TEMPLATE_ID` overrides it, but the magic number is undocumented.

### Account Page Is a Redirect Stub
`src/app/account/page.jsx` exists only as an OAuth callback landing page. The actual account UI is in `components/account-sidebar.jsx`. This is a documented convention but may confuse newcomers.

### Large Page Files
Some page files are very large:
- `/chart/page.jsx` — ~4685 lines
- `/explore/page.jsx` — ~1710 lines
- `/portfolio-tracker/page.jsx` — ~1760 lines

## Infrastructure

### No Testing
No test runner, test files, or CI pipeline for automated testing.

### No Monitoring
No error tracking, performance monitoring, or uptime alerts.

### No Rate Limiting
API routes have no rate limiting — a misbehaving client could overwhelm Yahoo Finance or Supabase.

### No Database Migrations
Schema changes are applied directly via Supabase SQL Editor. No migration tool (Prisma, Drizzle) is configured. `supabase/setup.sql` is the source of truth but must be kept in sync manually.

### Service Worker Versioning
`public/sw.js` has a manual version string (`VERSION = '1.3.42'`). Must be incremented when cache strategy changes.

## Feature Limitations

### Deno / Supabase Edge Functions
A `supabase/functions/` directory is referenced in some configurations but no Edge Functions are active.

### MSCI Data Is Manually Seeded
MSCI stock data is seeded manually via `supabase/msci_seed.sql` (referenced in setup). No automated process keeps MSCI data current.

### Vercel Cron Not Configured for Money Flow
The money flow cron (`/api/cron/money-flow`) has no schedule in `vercel.json`. It must be triggered manually or a schedule must be added.

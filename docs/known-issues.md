# Known Issues

## Security

### XOR Cipher Is Not Cryptography
`lib/secure-payload.js` uses simple XOR with a repeating key. Anyone with the `SECURE_PAYLOAD_KEY` or who reverse-engineers the pattern can read all API responses. This is obfuscation only — not a substitute for HTTPS or signed JWTs.

### CORS Enforcement Is Partial
`src/proxy.js` (formerly `middleware.js`) applies CORS headers permissively — it contains no origin-blocking logic in any form, not even commented out. CORS is decorative, not protective. (Phase 7 added a per-IP rate limit for `/api/screeners` in the proxy — see below — but CORS itself remains decorative.)

### Stockbit API Scraping
The money flow cron (`/api/cron/money-flow`) authenticates to `https://exodus.stockbit.com` (a private/undocumented API) using a user bearer token. This is fragile and may violate Stockbit's ToS.

## Code Quality

### Hardcoded USD/IDR Exchange Rate
`lib/msci-calculations.js` hardcodes `USD_TO_IDR = 15_800`. Should fetch a live exchange rate.

### Money Flow Cron Truncates All Data — RESOLVED (Phase 7)
The cron previously deleted `money_flow_reports` + `weekly_reports` before
fetching. It now truncates **after** a fully successful fetch; a partial or
failed run leaves existing data intact. Historical weekly rows are retained
(upsert on `week_start` overwrites only the current week).

### Hardcoded Screener Template ID
`DEFAULT_SCREENER_TEMPLATE_ID = "5461641"` is hardcoded in the money flow cron. The env var `STOCKBIT_SCREENER_TEMPLATE_ID` overrides it, but the magic number is undocumented.

### Account Page Is a Redirect Stub
`src/app/account/page.jsx` exists only as an OAuth callback landing page. The actual account UI is in `components/account-sidebar.jsx`. This is a documented convention but may confuse newcomers.

### Large Page Files
Some page files are very large:
- `/chart/page.jsx` — ~2780 lines
- `/explore/page.jsx` — ~1420 lines
- `/portfolio-tracker/page.jsx` — ~1190 lines

## Infrastructure

### Testing — RESOLVED (Phase 12)
Vitest unit tests (`tests/unit/`, 113 tests) + Playwright E2E smoke tests
(`e2e/`) are now configured and wired into CI. Remaining gaps are coverage,
not infrastructure: no component tests (jsdom + Testing Library), no API-route
integration tests against a Supabase emulator, no authenticated E2E flows.

### No External Monitoring — PARTIALLY RESOLVED (Phase 7)
No external platform (Sentry etc.) — intentionally out of scope for Phase 7.
Structured JSON logging added: every Yahoo call logs `source: "yahoo"`,
status, and duration; cron runs log summary lines with counts. `GET
/api/health` provides an external liveness probe. No uptime alerting.

### No Rate Limiting — PARTIALLY RESOLVED (Phase 7)
`/api/screeners` is rate-limited to 20 req/min/IP in `src/proxy.js`
(per-instance in-memory fixed window; 429 + `Retry-After`). All other API
routes remain unthrottled.

### No Database Migrations
Schema changes are applied directly via Supabase SQL Editor. No migration tool (Prisma, Drizzle) is configured. `supabase/setup.sql` is the source of truth but must be kept in sync manually.

### Service Worker Versioning
`public/sw.js` `VERSION` is now aligned with `package.json` (`1.7.56`). Rule:
bump `VERSION` on every service-worker change or users keep the old worker
until it is manually updated.

## Feature Limitations

### Deno / Supabase Edge Functions
A `supabase/functions/` directory is referenced in some configurations but no Edge Functions are active.

### MSCI Data Is Manually Seeded
MSCI stock data is seeded manually via `supabase/msci_seed.sql` (referenced in setup). No automated process keeps MSCI data current.

### Vercel Cron Not Configured — RESOLVED BY DECISION (Phase 7)
`vercel.json` is empty. Scheduling is **intentionally disabled** by decision
(2026-07-31): screeners run via the rate-limited manual trigger on explore,
money-flow must be invoked manually with `CRON_SECRET`. See
`docs/deployment.md` for the recorded decision and the historical schedule.

### Heavy Decorative GIF (trump.gif)
`public/trump.gif` is 3.1 MB (500×500) but rendered at 64–96 px with
`opacity-30` (chart page election-cycle watermark). Now `loading="lazy"`.
Re-encoding (palette/scale down with ffmpeg/giflossy) deferred — no image
tooling available in the Phase 7 environment.

### Image Optimization Disabled
`next.config.mjs` sets `images.unoptimized: true`. All images use `next/image`
but are served unoptimized, which is intentional: URLs pass through unchanged
(preserving the `/aruna.png` service-worker precache and avoiding Vercel
image-optimization usage). Revisit only if the app grows real image payloads.

## Resolved in Phase 7 (2026-07-31)

- **No error boundaries** → `src/app/error.jsx` + `src/app/global-error.jsx`
  added. Any route/root error now renders an in-app retry screen instead of a
  blank page.
- **No fetch timeouts** → 20 s timeout on Yahoo calls (single choke point in
  `src/lib/yahoo-finance.js`), 20 s on Stockbit fetches, 55 s on the cron
  trigger self-call, 30 s client-side default in `fetchEncodedJson`.
- **Discussions error responses unencoded** → all `/api/discussions` error
  responses now use `payload: encodePayload({ error })`; the client surfaces
  non-encoded `{ error }` bodies (e.g. 429s) with their real message.
- **Native `alert()` calls (11 sites)** → replaced with shadcn `sonner` toasts
  (`src/components/ui/sonner.jsx`, mounted in root layout).
- **Missing security headers** → added via `next.config.mjs` `headers()`
  (nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS,
  report-only CSP).
- **`middleware.js` deprecation** → renamed to `src/proxy.js` (Next 16 proxy
  convention); build warning gone.

## Resolved in Phase 8 (Feature Stabilization)

- **Edit Watchlist dialog always empty** → `ManageWatchlistDialog` is a
  controlled Radix Dialog, so `onOpenChange(true)` never fires on open and the
  old "seed on open" logic was dead code. Items are now seeded from the
  `watchlist` prop on the open edge via an effect. Edit is also gated on
  `watchlistReady` so it can't open against the pre-load empty state.
- **Guest watchlist not persisted** → watchlist now writes/reads
  `aruna_watchlist` in `localStorage` for non-authenticated users (the key was
  already reserved in `clear-data-button.jsx`); authenticated users keep
  Supabase sync.
- **Duplicate back button on `/idx-bubbles`** → the page's own back `<Link>`
  was removed; `MarketBubbles` owns the fullscreen header (back +
  timeframe + download) in both loading and loaded states.
- **Dark-mode hover overriding active market tab** → explore's
  `SegmentedControl` `activeClassName` lacked `dark:hover:bg-*`; the ghost
  variant's `dark:hover:bg-accent/50` won on hover. Fixed by adding
  `dark:hover:bg-primary` / `dark:hover:bg-foreground`.
- **OAuth callback redirect race** → OAuth callback pages carry `?code=`
  while the session exchange is still in flight; a premature redirect could
  bounce the user back through sign-in. `AuthProvider` keeps `loading=true`
  until the first session event (10 s fallback) and `/account` waits for auth
  before redirecting.
- **Device-aware first load** → `/` is now a client redirect: authenticated
  users go to `/watchlist` on mobile and `/explore` on desktop; guests keep
  the existing `/explore` onboarding. `/account`'s no-param default matches.
- **Money Flow disable flag** → `MONEY_FLOW_ENABLED` (server) +
  `NEXT_PUBLIC_MONEY_FLOW_ENABLED` (client) gate the page, tools menu entry,
  manifest shortcut, `/api/money-flow` (404), and the cron (no-op). Set both
  to `false` to hide the feature; flip back to re-enable without code changes.

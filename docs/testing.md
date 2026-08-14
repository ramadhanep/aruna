# Testing

## Overview

Two test layers:

| Layer | Runner | Location | Scope |
|---|---|---|---|
| Unit | Vitest | `tests/unit/*.test.js` | Pure business logic in `src/lib/` (calculations, formatters, scoring) |
| E2E | Playwright | `e2e/*.spec.mjs` | Browser smoke tests of the app shell and navigation |

Vitest runs in CI on every push/PR; Playwright runs in a separate CI job
(Chromium only). See `.github/workflows/ci.yml`.

## Scripts

| Command | What It Runs |
|---|---|
| `npm run test` | Vitest once (CI) |
| `npm run test:watch` | Vitest watch mode (dev) |
| `npm run test:e2e` | Playwright E2E (requires a built app; the Playwright `webServer` boots `next start` on port 3100) |

## Configuration

- `vitest.config.mjs` — `node` environment, `@/` → `./src` alias, includes
  `tests/**/*.test.js`.
- `playwright.config.mjs` — two projects (`chromium` desktop + `mobile-chromium`
  Pixel 5), `baseURL http://localhost:3100`, auto-starts the production server,
  trace on first retry.

Local E2E requires a browser the first time:

```bash
npx playwright install chromium
```

## Covered Units

- `utils` — `cn()`, display formatters, stable colors, change tones.
- `portfolio-metrics` — FX conversion, holdings metrics, sorting, summaries,
  allocation breakdowns.
- `secure-payload` — XOR encode/decode roundtrip (via `keyOverride`, no env).
- `msci-calculations` — thresholds, progress, target price, upside, badges.
- `chart-helpers` — RSI, EMA, smoothing, Livermore levels, tab mapping.
- `money-flow` — scoring weights, volume spike, signal classification.
- `time`, `default-watchlist`, `stock-universe` — range math, fresh copies,
  universe integrity (duplicate detection).

## Conventions

- Import `describe/it/expect` from `vitest` explicitly (no globals) so ESLint's
  `no-undef` stays happy.
- Tests must be deterministic and offline — no network, no Supabase, no browser.
  For `secure-payload` pass `keyOverride` instead of relying on env.
- Intl output (currency glyphs, non-breaking spaces) varies across ICU builds —
  normalize with `replace(/\u00a0/g, '')` or assert on digits with `toContain`,
  never on exact currency symbols.
- Fix bugs found while writing tests in the same commit (see the
  `formatMarketCap` ".0" trim and the crypto-universe duplicate removal).

## Manual Testing (unchanged)

- API routes via `curl` or Bruno (`aruna-api.json`).
- Cron jobs via `curl -H "Authorization: Bearer <secret>" http://localhost:3000/api/cron/idx`.

## Future Recommendations

- Component tests (Vitest + jsdom + Testing Library) for `src/components/`.
- API route integration tests against a Supabase local emulator.
- Expand E2E to cover authenticated flows (sign-in session fixture).

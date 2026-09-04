# Known Issues

## Security

- XOR payload encoding is obfuscation only, not cryptography.
- `src/proxy.js` applies CORS headers but does not block origins.
- `money-flow` cron uses a private Stockbit API and may be fragile.

## Product Limits

- USD/IDR fallback rate is hardcoded.
- MSCI stock data is manually seeded.
- Some large pages still exist and are intentionally kept for now.

## Infrastructure Limits

- No database migration tool is configured.
- No external error monitoring is configured.
- `public/sw.js` version must be bumped when cache logic changes.

## Notes

- `docs/roadmap.md` tracks completed and planned work.
- `docs/architecture-decisions.md` tracks the deliberate tradeoffs.

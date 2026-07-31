# Roadmap

## Completed

- ✅ Yahoo Finance data proxy (charts, quotes, fundamentals, search)
- ✅ Seasonal chart analysis with election cycles
- ✅ Watchlist with local-first sync and Supabase cloud backup
- ✅ Portfolio tracker with multi-currency (IDR/USD/SGD)
- ✅ Institutional money flow analysis (Stockbit integration)
- ✅ MSCI inclusion tracker (Standard + Small Cap)
- ✅ EMA-31 momentum scanner for IDX/US/Crypto
- ✅ Market bubble map (canvas visualization)
- ✅ Relative Rotation Graph (SVG scatter plot)
- ✅ Community discussion chat with stock mentions
- ✅ PWA support (service worker, manifest, offline page)
- ✅ Google OAuth authentication
- ✅ Mobile-first responsive design
- ✅ Dark/light theme switching
- ✅ Symbol search dialog with history
- ✅ Trending stocks marquee
- ✅ API response XOR obfuscation
- ✅ Trial gating infrastructure
- ✅ Dynamic PWA manifest
- ✅ Auto logo sync from Pluang CDN to Supabase storage
- ✅ Batch quote API with mini-chart data
- ✅ Bruno/Postman API collection (`aruna-api.json`)
- ✅ Pricing page (`src/app/pricing/page.jsx`)
- ✅ Trial-based feature gating (`TrialProvider`, `TrialGuard`, `TrialBanner`)
- ✅ Error boundaries (`error.jsx`, `global-error.jsx`)
- ✅ Security headers (CSP report-only, HSTS, frame/type/referrer/permissions)
- ✅ Screener rate limiting (20 req/min/IP in `src/proxy.js`)
- ✅ Liveness health endpoint (`/api/health`)
- ✅ CI gate (GitHub Actions: lint + build)
- ✅ Structured request logging (Yahoo + cron summary lines)
- ✅ Cron scheduling decision (disabled, documented)
- ✅ Fetch timeouts (Yahoo/Stockbit/cron/client)

## In Progress

- 🔄 Documentation system (this project)

## Planned

- 📋 Testing infrastructure (Jest/Vitest + Playwright + E2E)
- 📋 Live USD/IDR exchange rate for MSCI calculations
- 📋 Full API rate limiting (all routes, not just screeners)
- 📋 Database migrations tooling
- 📋 External error monitoring (Sentry or similar) — deferred beyond Phase 7

## Future Improvements

- 🔮 Apple OAuth provider (in addition to Google)
- 🔮 Push notifications for money flow signals
- 🔮 Portfolio performance history/charts
- 🔮 Stock screener custom filters (beyond EMA-31 momentum)
- 🔮 Real-time price updates via WebSocket
- 🔮 Dark mode improvements for chart components
- 🔮 TypeScript migration (gradual)
- 🔮 Internationalization (i18n) for Indonesian language support
- 🔮 Accessibility audit and improvements

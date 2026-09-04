# Folder Structure

```
/
├── OPENCODE.md                      # AI entry point — read first
├── docs/                            # Project documentation
├── src/                             # Application source code
│   ├── proxy.js                      # Request interception (CORS + screener rate limit) — renamed from middleware.js in Next 16
│   ├── app/                         # Next.js App Router
│   │   ├── layout.jsx               # Root layout (providers, PWA, theme)
│   │   ├── page.jsx                 # Landing page (redirects to /explore)
│   │   ├── globals.css              # Global styles, CSS variables, utilities
│   │   ├── not-found.jsx            # Custom 404 page
│   │   ├── manifest.json/           # Dynamic PWA manifest (Route Handler)
│   │   ├── explore/                 # Market dashboard
│   │   │   └── page.jsx             # Dashboard with categories, money flow, tools
│   │   ├── chart/                   # Supercharts (seasonal, candlestick, fundamentals)
│   │   │   └── page.jsx             # Main chart analysis page (~2780 lines)
│   │   ├── watchlist/               # Tracked symbols with live quotes
│   │   │   └── page.jsx
│   │   ├── portfolio-tracker/       # Portfolio P&L tracker
│   │   │   ├── page.jsx             # Main portfolio page
│   │   │   └── pie.jsx              # Portfolio pie chart component
│   │   ├── money-flow/              # Institutional money flow reports
│   │   │   └── page.jsx
│   │   ├── msci/                    # MSCI inclusion tracker
│   │   │   └── page.jsx
│   │   ├── idx-bubbles/             # Full-screen market bubble map
│   │   │   └── page.jsx
│   │   ├── idx-momentum/            # IDX EMA-31 momentum scanner
│   │   │   └── page.jsx
│   │   ├── idx-rotation/            # Relative Rotation Graph (RRG)
│   │   │   └── page.jsx
│   │   ├── discussion/              # Community chat
│   │   │   └── page.jsx
│   │   ├── tools/                   # Mobile-friendly tools menu
│   │   │   └── page.jsx
│   │   ├── signin/                  # Google/email sign-in page
│   │   │   └── page.jsx
│   │   ├── account/                 # OAuth callback redirect stub
│   │   │   └── page.jsx
│   │   ├── offline/                 # PWA offline fallback
│   │   │   └── page.jsx
│   │   └── api/                     # API Route Handlers
│   │       ├── finance/             # GET: Yahoo Finance OHLCV proxy + logo sync
│   │       ├── quotes/              # POST: Batch quote fetch (up to 50 symbols)
│   │       ├── price-series/        # GET: Price series with multiple timeframes
│   │       ├── symbol-search/       # GET: Yahoo Finance symbol search
│   │       ├── fundamentals/        # GET: Stock fundamentals + earnings
│   │       ├── screeners/[category]/ # GET: On-demand screener (idx/us/crypto)
│   │       ├── bubbles/             # GET: Market bubbles from Supabase
│   │       ├── rotation/            # GET: RRG data from Supabase
│   │       ├── momentum/            # GET: IDX momentum from Supabase
│   │       ├── money-flow/          # GET: Money flow reports from Supabase
│   │       ├── msci/                # GET: MSCI tracker data
│   │       ├── discussions/         # GET/POST/DELETE: Chat messages
│   │       ├── delete-account/      # POST: Delete user and all data
│   │       └── cron/
│   │           ├── [category]/      # GET: Trigger screener (cron target)
│   │           └── money-flow/      # GET: Run Stockbit money flow (cron target)
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives
│   │   │   ├── accordion.jsx
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── chart.jsx            # Recharts wrapper
│   │   │   ├── dialog.jsx
│   │   │   ├── dropdown-menu.jsx
│   │   │   ├── input.jsx
│   │   │   ├── label.jsx
│   │   │   ├── select.jsx
│   │   │   ├── segmented-control.jsx # Behavior wrapper: maps options to Buttons, owns selection state
│   │   │   ├── sheet.jsx
│   │   │   ├── skeleton.jsx
│   │   │   ├── table.jsx
│   │   │   ├── tooltip.jsx
│   │   │   ├── sonner.jsx            # Toasts (shadcn sonner, mounted in root layout)
│   │   │   ├── progress.jsx          # Progress bar primitive (indicatorClassName extended)
│   │   │   ├── tabs.jsx              # Radix tabs
│   │   │   └── command.jsx           # cmdk command palette/search primitive
│   │   ├── mini-chart.jsx           # Lightweight sparkline chart component
│   │   ├── app-layout-client.jsx    # Layout shell (nav, sidebar, chrome)
│   │   ├── auth-provider.jsx        # Auth context + watchlist/portfolio sync
│   │   ├── account-sidebar.jsx      # Slide-out account panel
│   │   ├── desktop-navbar.jsx       # Desktop top navigation bar
│   │   ├── mobile-bottom-nav.jsx    # Mobile bottom tab bar
│   │   ├── header-symbol-search.jsx  # Global symbol search dialog
│   │   ├── header-account-menu.jsx  # Mobile header account button
│   │   ├── market-bubbles.jsx       # Canvas-based bubble visualization
│   │   ├── scatter-skeleton.jsx     # Full-screen dot-field loading state (bubbles, rotation)
│   │   ├── normal-candlestick-chart.jsx  # lightweight-charts wrapper
│   │   ├── money-flow-card.jsx      # Expandable money flow report card
│   │   ├── ticker-avatar.jsx        # Symbol logo with fallback
│   │   ├── ticker-row.jsx           # Shared symbol row (logo, name, price, change)
│   │   ├── ticker-row-skeleton.jsx  # Loading skeleton matching ticker-row.jsx
│   │   ├── trending-marquee.jsx     # Auto-scrolling trending symbols
│   │   ├── manage-watchlist-dialog.jsx  # Add/remove/reorder symbols
│   │   ├── add-asset-modal.jsx      # Add asset to portfolio
│   │   ├── theme-provider.jsx       # next-themes wrapper
│   │   ├── appearance-mode-provider.jsx  # Visual mode (pro/lite)
│   │   ├── pwa-register.jsx         # Service worker registration
│   │   ├── pwa-install-dialog.jsx   # PWA install prompt
│   │   ├── aruna-watermark.jsx      # SVG watermark overlay
│   │   ├── google-glyph.jsx         # Google logo SVG for sign-in
│   │   ├── clear-data-button.jsx    # Clear local + remote data
│   │   ├── mode-toggle.jsx          # Theme toggle (light/dark)
│   │   ├── chart-header-bar.jsx     # Chart symbol header with cycle selector
│   │   ├── chart-trading-plan-panel.jsx  # Trading-plan feature panel (risk-first sizing calculator)
│   │   ├── chart-seasonality-panel.jsx   # Seasonality stat cards + heatmap tables
│   │   ├── analyst-gauge-chart.jsx  # Analyst rating semicircle gauge
│   │   └── portfolio-mini-chart.jsx # SVG mini sparkline for portfolio overview
│   ├── hooks/
│   │   ├── use-mobile.js            # Mobile breakpoint detection (1024px)
│   │   ├── use-chart-state.js       # Chart URL param ↔ state sync + localStorage
│   │   ├── use-chart-data.js        # Seasonal chart data fetching
│   │   ├── use-chart-series.js      # Normal candlestick series + indicators
│   │   ├── use-chart-fundamentals.js # Lazy fundamentals with cache
│   │   ├── use-chart-screening.js   # Screening signal + realtime subscription
│   │   ├── use-pull-to-refresh.js   # Shared pull-to-refresh gesture (window or container scroll)
│   │   └── use-portfolio-data.js    # Portfolio entries lifecycle, prices, FX, mini-series
│   └── lib/
│       ├── api-client.js            # fetchEncodedJson, searchSymbols, fetchLatestQuote — XOR-decoded API access
│       ├── secure-payload.js        # XOR cipher encode/decode
│       ├── supabase-browser.js      # Browser Supabase client singleton
│       ├── supabase-server.js       # Service-role Supabase client + getUserFromRequest
│       ├── supabase-storage.js      # SUPABASE_STORAGE_BASE, PLUANG_CDN_BASE, getIdxLogoUrl, getUsLogoUrl
│       ├── logo-cache.js            # ensureUsLogo — server-only US logo HEAD/download/upload cache
│       ├── market-data-cache.js     # Best-effort quotes/price-series DB cache (TTL, prune, in-flight dedupe)
│       ├── yahoo-finance.js         # Configured yahoo-finance2 instance
│       ├── yahoo-raw-log.js         # Dev-only Yahoo API response logging
│       ├── money-flow.js            # Stockbit URL builders, score calculations
│       ├── msci-calculations.js     # MSCI threshold/progress/target calculations
│       ├── seasonalData.js          # Seasonal pattern computation (returns, heatmaps)
│       ├── stock-universe.js        # Static IDX/US SP500/Crypto symbol arrays
│       ├── default-watchlist.js     # Default watchlist for guest users
│       ├── tools-menu.js            # TOOLS_ITEMS config for nav
│       ├── utils.js                 # cn(), formatTickerDisplay(), formatMarketCap(), etc.
│       ├── chart-helpers.js         # Chart-specific constants, technical indicators, formatters
│       ├── portfolio-storage.js     # Canonical aruna-portfolio adapter + migration
│       ├── portfolio-metrics.js     # Pure portfolio calculations (metrics, sort, allocations)
│       └── lightweight-charts-loader.js  # Dynamic import for lightweight-charts
├── public/                          # Static assets
│   ├── aruna.png                    # App icon / logo
│   ├── aruna-black.png              # Dark variant logo
│   ├── sw.js                        # PWA service worker (VERSION must match app version)
│   ├── _headers                     # Vercel headers for service worker
│   ├── trump.gif                    # Election-cycle watermark (chart page)
│   ├── anteck.gif          # Election-cycle watermark (chart page)
│   └── america-eagle.gif            # Election-cycle watermark (chart page)
├── supabase/
│   └── setup.sql                    # Complete DB setup (schema, RLS, seeds)
├── .env.template                    # Environment variable template
├── next.config.mjs                  # Next.js configuration
├── vercel.json                       # Vercel deployment + cron config
├── components.json                  # shadcn/ui configuration
├── eslint.config.mjs                # ESLint configuration
├── vitest.config.mjs                # Vitest unit test configuration (tests/)
├── playwright.config.mjs            # Playwright E2E configuration (e2e/)
├── jsconfig.json                    # JS path aliases (@/ → src/)
├── postcss.config.mjs               # PostCSS configuration
├── package.json                     # Dependencies and scripts
├── tests/                           # Vitest unit tests (tests/unit/*.test.js)
├── e2e/                             # Playwright E2E specs (e2e/*.spec.mjs)
└── aruna-api.json                   # Postman/Bruno API collection
```

## Where New Code Should Live

| What | Where |
|---|---|
| New page | `src/app/<route-name>/page.jsx` |
| New API endpoint | `src/app/api/<endpoint-name>/route.js` |
| New UI primitive | `src/components/ui/<name>.jsx` |
| New feature component | `src/components/<name>.jsx` |
| New business logic | `src/lib/<name>.js` |
| New hook | `src/hooks/use-<name>.js` |
| New unit test | `tests/unit/<name>.test.js` |
| New E2E spec | `e2e/<name>.spec.mjs` |
| New DB table | Add to `supabase/setup.sql` |
| New environment variable | Add to `.env.template` and `docs/environment.md` |

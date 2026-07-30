# Folder Structure

```
/
├── CLAUDE.md                        # AI entry point — read first
├── docs/                            # Project documentation
├── src/                             # Application source code
│   ├── middleware.js                 # CORS enforcement for /api/* routes
│   ├── app/                         # Next.js App Router
│   │   ├── layout.jsx               # Root layout (providers, PWA, theme)
│   │   ├── page.jsx                 # Landing page (redirects to /explore)
│   │   ├── globals.css              # Global styles, CSS variables, utilities
│   │   ├── not-found.jsx            # Custom 404 page
│   │   ├── manifest.json/           # Dynamic PWA manifest (Route Handler)
│   │   ├── explore/                 # Market dashboard
│   │   │   └── page.jsx             # Dashboard with categories, money flow, tools
│   │   ├── chart/                   # Supercharts (seasonal, candlestick, fundamentals)
│   │   │   └── page.jsx             # Main chart analysis page (4685 lines)
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
│   │   ├── signin/                  # Google sign-in page
│   │   │   └── page.jsx
│   │   ├── account/                 # OAuth callback redirect stub
│   │   │   └── page.jsx
│   │   ├── pricing/                 # Subscription/pricing page
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
│   │   │   ├── radio-group.jsx
│   │   │   ├── select.jsx
│   │   │   ├── separator.jsx
│   │   │   ├── sheet.jsx
│   │   │   ├── sidebar.jsx          # shadcn sidebar (not actively used)
│   │   │   ├── skeleton.jsx
│   │   │   ├── table.jsx
│   │   │   └── tooltip.jsx
│   │   ├── app-layout-client.jsx    # Layout shell (nav, sidebar, chrome)
│   │   ├── auth-provider.jsx        # Auth context + watchlist/portfolio sync
│   │   ├── account-sidebar.jsx      # Slide-out account panel
│   │   ├── desktop-navbar.jsx       # Desktop top navigation bar
│   │   ├── mobile-bottom-nav.jsx    # Mobile bottom tab bar
│   │   ├── header-symbol-search.jsx  # Global symbol search dialog
│   │   ├── header-account-menu.jsx  # Mobile header account button
│   │   ├── market-bubbles.jsx       # Canvas-based bubble visualization
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
│   │   ├── trial-provider.jsx       # Trial gating state
│   │   ├── trial-banner.jsx         # Trial expiry banner
│   │   ├── trial-guard.jsx          # Trial access guard wrapper
│   │   ├── pwa-register.jsx         # Service worker registration
│   │   ├── pwa-install-dialog.jsx   # PWA install prompt
│   │   ├── aruna-watermark.jsx      # SVG watermark overlay
│   │   ├── google-glyph.jsx         # Google logo SVG for sign-in
│   │   ├── clear-data-button.jsx    # Clear local + remote data
│   │   └── mode-toggle.jsx          # Theme toggle (light/dark)
│   ├── hooks/
│   │   └── use-mobile.js            # Mobile breakpoint detection (1024px)
│   └── lib/
│       ├── api-client.js            # fetchEncodedJson — XOR-decoded fetch
│       ├── secure-payload.js        # XOR cipher encode/decode
│       ├── supabase-browser.js      # Browser Supabase client singleton
│       ├── supabase-server.js       # Service-role Supabase client + getUserFromRequest
│       ├── yahoo-finance.js         # Configured yahoo-finance2 instance
│       ├── yahoo-raw-log.js         # Dev-only Yahoo API response logging
│       ├── money-flow.js            # Stockbit URL builders, score calculations
│       ├── msci-calculations.js     # MSCI threshold/progress/target calculations
│       ├── seasonalData.js          # Seasonal pattern computation (returns, heatmaps)
│       ├── stock-universe.js        # Static IDX/US SP500/Crypto symbol arrays
│       ├── default-watchlist.js     # Default watchlist for guest users
│       ├── tools-menu.js            # TOOLS_ITEMS config for nav
│       ├── utils.js                 # cn(), formatTickerDisplay(), formatMarketCap(), etc.
│       └── lightweight-charts-loader.js  # Dynamic import for lightweight-charts
├── public/                          # Static assets
│   ├── aruna.png                    # App icon / logo
│   ├── aruna-black.png              # Dark variant logo
│   ├── sw.js                        # PWA service worker
│   ├── _headers                     # Vercel headers for service worker
│   ├── chart-mockup.png             # Landing page assets
│   ├── dashboard-mockup.png
│   ├── landing.png
│   ├── portfolio-mockup.png
│   └── *.svg                        # Next.js default icons
├── supabase/
│   └── setup.sql                    # Complete DB setup (schema, RLS, seeds)
├── .env.template                    # Environment variable template
├── next.config.mjs                  # Next.js configuration
├── vercel.json                       # Vercel deployment + cron config
├── components.json                  # shadcn/ui configuration
├── eslint.config.mjs                # ESLint configuration
├── jsconfig.json                    # JS path aliases (@/ → src/)
├── postcss.config.mjs               # PostCSS configuration
├── package.json                     # Dependencies and scripts
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
| New DB table | Add to `supabase/setup.sql` |
| New environment variable | Add to `.env.template` and `docs/environment.md` |

<div align="center">

<img src="public/aruna.png" alt="Aruna Logo" width="100" />

# Aruna

**Smart seasonal charts. Election-cycle context. One app for IDX, US & crypto.**

A mobile-first stock market analysis PWA for retail investors. Built with Next.js 16, React 19, and Supabase.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

</div>

---

## Why Aruna

Retail investors usually jump between multiple tools to answer simple questions:

- What is the trend doing **seasonally**?
- Where is **institutional money** flowing?
- Which names are close to **MSCI inclusion**?
- What is **moving now** across IDX, US, and crypto?
- What do I already **own or watch**?

Aruna puts those workflows in one place.

---

## Features

### Seasonal Charts & Election-Cycle Patterns

The core differentiator. Overlay current year's price action against historical averages segmented by **U.S. presidential election cycle** — Election Year, Post-Election, Mid-Term, and Pre-Election. Includes Hirsch-style seasonal pattern calculation (cumulative single-year and multi-year).

<img src="public/trump.gif" alt="Election-cycle seasonal chart" width="200" />

### Supercharts

Full-featured interactive charts powered by TradingView Lightweight Charts:

- **Chart types**: Candlestick, Heikin-Ashi, Line
- **8 timeframes**: 15m, 1h, 2h, 4h, 1D, 1W, 1M, All
- **Seasonal overlay** with quarter filter and CAGR YTD return
- **Logarithmic scale** and **Livermore key** overlay
- **Fundamentals sidebar**: Key stats, valuations, P/E, market cap, volume, 50/200-day averages, 52-week range
- **Company profile**: Business summary, sector, industry, HQ, employees, website
- **Governance risk**: Audit, board, compensation, shareholder rights risk scores
- **Leadership**: Company officers display
- **Analyst recommendations**: Gauge chart (Strong Buy → Strong Sell) with price targets
- **Earnings chart**: Actual vs estimate with beat/miss indicators
- **Revenue chart**: Quarterly/annual revenue & earnings bars
- **Seasonality panel**: Monthly and quarterly return heatmaps with win-rate probabilities
- **Trading plan panel**: Position calculator (entry, stop loss, take profit, risk/reward, lot sizing)
- **News feed**: Per-symbol news from Yahoo Finance

### Market Dashboard (`/explore`)

- **Market pulse ticker**: Live scrolling strip — IHSG, S&P 500, BTC, Gold, Nasdaq, USD/IDR
- **Tabbed market categories**: US, Indonesia, Global, Crypto, Commodities
- **Timeframe selector**: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, ATH
- **Trending marquee**: Auto-scrolling trending stocks by category
- **Breakout signals**: Real-time screener results from IDX, US, and crypto
- **MSCI preview**: Progress-to-qualification candidates
- **Rotation preview**: RRG overview across sectors

### Analytical Tools

| Tool | Description |
|---|---|
| **Easeason** | Seasonal asset research & U.S. election-cycle pattern visualization ([easeason.vercel.app](https://easeason.vercel.app/)) |
| **Bubbles** | Full-screen SVG bubble map showing IDX gain/loss by market cap |
| **MSCI Tracker** | Standard & Small Cap candidates with qualification price, upside %, free float, status badges |
| **Momentum** | IDX bullish/bearish/neutral scanner with market cap and weekly/monthly views |
| **Rotation** | Relative Rotation Graph (RRG) — 4-quadrant Leading, Weakening, Lagging, Improving |
| **Money Flow** | Accumulation/distribution scores with volume spike detection (weekly/monthly/quarterly) |

### Watchlist

- Add/remove/reorder tracked symbols
- Live quotes with mini sparkline charts
- Market pulse: top gainer, top loser, portfolio average
- Auto-refresh every 60 seconds
- Pull-to-refresh on mobile

### Portfolio Tracker

- Digital assets (stocks/crypto) + cash entries
- Multi-currency support: IDR, USD, SGD
- Live FX rates with alpha, market value, and P&L
- Pie chart allocation visualization
- Sort by various metrics
- "Count as cash" option for digital assets
- Lot/share unit support (IDX-aware 100 shares/lot)

### Community Chat (`/discussion`)

- Real-time messaging via Supabase
- `$CODE` for IDX stocks (clickable → chart)
- `US$CODE` for US stocks (clickable → chart)
- System messages for joins
- User avatars and profile

### PWA & Offline

- Install as a Progressive Web App on any device
- Works offline via service worker with 5-layer cache strategy
- App shell precache for instant loading
- Stale-while-revalidate for assets
- Network-first for API requests
- Offline fallback page

### UX

- **Dark/Light theme** (default: dark)
- **Appearance modes**: "Pro" (full features) vs "Lite" (simplified)
- **Language toggle**: English / Bahasa Indonesia
- **Symbol search**: cmdk-powered command palette
- **Pull-to-refresh** on mobile
- **Scroll-aware navigation**: bottom nav hides on scroll down

---

## Screenshots

| Explore | Supercharts | Watchlist | Portfolio |
|---|---|---|---|
| Market dashboard with pulse, categories, trending | Seasonal election-cycle overlay with fundamentals | Live quotes with sparklines | Holdings P&L with multi-currency |

---

## Tech Stack

### Core

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (19 primitives) |
| State | React Context + localStorage |
| Auth | Supabase Auth (Email/Password, Google OAuth) |
| Database | Supabase PostgreSQL (14 tables, RLS) |
| Charts | TradingView Lightweight Charts, Recharts |
| Icons | Lucide React |
| i18n | next-intl (EN, ID) |
| Theme | next-themes (dark/light) |
| Notifications | Sonner |
| Search | cmdk |

### Data Sources

| Source | Data |
|---|---|
| Yahoo Finance | Stock/crypto prices, fundamentals, news |
| Supabase | User data, screeners, trending, MSCI, money flow cache |
| Stockbit | Money flow reports (private API, via proxy) |
| Pluang CDN | US stock logos |

### Dev Tools

| Tool | Purpose |
|---|---|
| Vitest | Unit testing |
| Playwright | E2E testing |
| ESLint | Linting |
| Vercel | Deployment & cron jobs |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project (for auth, database, and API features)

### Setup

```bash
git clone https://github.com/your-username/aruna.git
cd aruna
npm install
cp .env.example .env.local
```

Fill in your environment variables (see [docs/environment.md](docs/environment.md)):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SECURE_PAYLOAD_KEY=your_xor_cipher_key
CRON_SECRET=your_cron_secret
APP_URL=http://localhost:3000
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database Setup

Run the SQL in `supabase/setup.sql` against your Supabase project to create tables and RLS policies.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |

---

## Project Structure

```
aruna/
├── public/                  # Static assets
│   ├── aruna.png            # App logo (transparent)
│   ├── aruna-black.png      # Dark variant logo
│   ├── trump.gif            # Election-cycle watermark
│   ├── america-eagle.gif    # Election-cycle watermark
│   ├── anteck.gif           # Election-cycle watermark
│   ├── sw.js                # Service worker
│   └── icons/               # PWA icons
├── src/
│   ├── app/                 # Next.js App Router (15 pages, 18 API routes)
│   │   ├── api/             # API routes (XOR-encoded responses)
│   │   ├── explore/         # Market dashboard
│   │   ├── chart/           # Supercharts
│   │   ├── watchlist/       # Watchlist
│   │   ├── portfolio-tracker/
│   │   ├── idx-bubbles/     # Bubble map
│   │   ├── idx-momentum/    # Momentum scanner
│   │   ├── idx-rotation/    # RRG
│   │   ├── money-flow/      # Money flow
│   │   ├── msci/            # MSCI tracker
│   │   ├── discussion/      # Community chat
│   │   └── ...
│   ├── components/          # 36 components
│   │   ├── ui/              # 19 shadcn/ui primitives
│   │   ├── desktop-navbar.jsx
│   │   ├── mobile-bottom-nav.jsx
│   │   ├── market-bubbles.jsx
│   │   ├── trending-marquee.jsx
│   │   ├── chart-seasonality-panel.jsx
│   │   ├── chart-trading-plan-panel.jsx
│   │   └── ...
│   ├── lib/                 # Shared logic
│   │   ├── api-client.js    # XOR-encoded API client
│   │   ├── secure-payload.js # XOR cipher
│   │   ├── tools-menu.js    # Tools dropdown config
│   │   └── utils.js         # cn(), formatters
│   └── hooks/               # Custom React hooks
├── messages/                # i18n (EN, ID — 21 namespaces each)
├── supabase/                # Database schema
├── docs/                    # Documentation (24 files)
├── tests/                   # Unit + E2E tests
└── opencode.json            # AI agent config
```

---

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/finance` | GET | Yahoo Finance chart data proxy |
| `/api/quotes` | POST | Batch quote fetcher (up to 50 symbols) |
| `/api/price-series` | GET | Price series data |
| `/api/symbol-search` | GET | Symbol name search |
| `/api/fundamentals` | GET | Company fundamentals |
| `/api/news` | GET | Per-symbol news feed |
| `/api/bubbles` | GET | Bubble map data |
| `/api/momentum` | GET | Momentum scanner data |
| `/api/rotation` | GET | RRG data |
| `/api/msci` | GET | MSCI tracker data |
| `/api/money-flow` | GET | Money flow reports |
| `/api/screeners/[category]` | GET | Screener results (IDX/US/Crypto) |
| `/api/discussions` | GET/POST/DELETE | Community chat CRUD |
| `/api/delete-account` | POST | Delete user account |
| `/api/health` | GET | Liveness probe |
| `/api/cron/*` | GET | Cron-triggered screeners |

All API responses are XOR-encoded (except health, cron, and manifest).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `APP_URL` | Yes | Production base URL |
| `SECURE_PAYLOAD_KEY` | Yes | XOR cipher key |
| `CRON_SECRET` | Yes | Cron endpoint auth |
| `NEXT_PUBLIC_MONEY_FLOW_ENABLED` | No | Toggle money flow feature (default: true) |
| `STOCKBIT_AUTHORIZATION_BEARER` | No | Stockbit API auth |

---

## Documentation

| Doc | Description |
|---|---|
| [Architecture](docs/architecture.md) | High-level system design |
| [API Reference](docs/api.md) | All API endpoints |
| [Database](docs/database.md) | PostgreSQL schema & RLS |
| [Authentication](docs/authentication.md) | Auth flows |
| [Tech Stack](docs/tech-stack.md) | Dependencies & integrations |
| [Environment](docs/environment.md) | Env variables reference |
| [Conventions](docs/conventions.md) | Code style & patterns |
| [Testing](docs/testing.md) | Test strategy |
| [Roadmap](docs/roadmap.md) | Planned features |
| [Contributing](CONTRIBUTING.md) | How to contribute |

---

## License

Private — not for redistribution.

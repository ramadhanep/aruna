# Aruna

**Version 1.7.56** — Mobile-first stock market analysis platform targeting Indonesian retail investors, with coverage of IDX (Indonesia), US equities, and crypto. Provides seasonal chart analysis, institutional money flow tracking, MSCI inclusion tracking, and a community discussion chat. Local-first architecture with optional Supabase cloud sync.

**Status:** Active development / production-ready core features. Several analytical tools (money flow, screeners) depend on scheduled cron jobs and third-party APIs.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Features & Pages](#4-features--pages)
5. [Database Schema](#5-database-schema)
6. [Authentication](#6-authentication)
7. [Environment Variables](#7-environment-variables)
8. [Known Issues & Messy Areas](#8-known-issues--messy-areas)
9. [Getting Started](#9-getting-started)

---

## 1. Project Overview

Aruna is a web app built for Indonesian retail investors who want seasonal and institutional context when analysing stocks. It aggregates data from Yahoo Finance, Stockbit, Ajaib, and Bibit, runs automated screeners, and presents it in a mobile-first progressive web app.

**Target users:** Indonesian retail stock traders and investors tracking IDX, US equities, and crypto assets.

**Core value propositions:**
- Seasonal pattern charts overlaid with election-cycle context
- Institutional money flow scoring sourced from Stockbit broker transaction data
- MSCI Standard / Small Cap inclusion progress tracker for IDX stocks
- Relative Rotation Graph (RRG) and market bubble map for sector analysis
- Local-first watchlist and portfolio with optional Supabase sync across devices

---

## 2. Tech Stack

### Framework & Runtime
| Package | Version | Role |
|---|---|---|
| Next.js | ^16.0.8 | App Router, API routes, SSR/SSG |
| React | 19.2.0 | UI |
| Node.js | (runtime) | Server-side API execution |

### Backend / Database
| Package | Version | Role |
|---|---|---|
| `@supabase/supabase-js` | ^2.79.0 | Auth, database, storage |
| `@supabase/ssr` | ^0.8.0 | SSR-safe Supabase client |
| `yahoo-finance2` | ^3.13.2 | Price data, quotes, symbol search |

**Supabase usage:**
- **Auth:** Google OAuth via Supabase Auth (client-side only; no server-side session cookies)
- **Database:** PostgreSQL with RLS — stores profiles, watchlists, portfolios, stock data, screener snapshots, money flow reports, discussions
- **Storage:** Bucket `us` for US stock SVG logos (auto-uploaded from Pluang CDN on first request), bucket `idx` for IDX logos

### UI & Styling
| Package | Version | Role |
|---|---|---|
| Tailwind CSS | ^4 | Utility-first styling |
| `@tailwindcss/postcss` | ^4 | PostCSS integration |
| `tw-animate-css` | ^1.4.0 | Animation utilities |
| `next-themes` | ^0.4.6 | Dark / light / system theme switching |
| `lucide-react` | ^0.548.0 | Icon set |
| Radix UI (various) | various | Headless accessible UI primitives |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.3.1 | Conditional class merging |

**Radix UI components in use:** Accordion, Dialog, DropdownMenu, Label, RadioGroup, Select, Separator, Slot, Tooltip.

### Charts & Data Visualisation
| Package | Version | Role |
|---|---|---|
| `recharts` | ^2.15.4 | Area, bar, composed, and heatmap charts |
| `lightweight-charts` | ^5.0.9 | TradingView-style candlestick/line charts |
| Vanta.js (CDN) | latest | Animated cloud background on landing page |

### Tailwind Config Customisations
- `tw-animate-css` is included for animation classes.
- `globals.css` defines custom CSS variables for `glass`, `liquid-glass` backdrop-blur utility classes used throughout the app.
- Theme variables use `oklch()` colour space (Tailwind v4 default).

---

## 3. Project Structure

```
aruna/
├── public/                  # Static assets, PWA service worker, _headers
├── scripts/sql/             # Utility SQL scripts
├── supabase/
│   └── setup.sql            # Complete DB setup: schema + migrations + seed data
├── src/
│   ├── middleware.js        # CORS enforcement for /api/* routes
│   ├── app/
│   │   ├── layout.jsx       # Root layout: ThemeProvider, AuthProvider, PWA
│   │   ├── page.jsx         # Landing page (Vanta clouds hero)
│   │   ├── globals.css      # Global styles, CSS variables, glass utilities
│   │   ├── not-found.jsx    # 404 page
│   │   ├── manifest.json/   # Dynamic PWA manifest route
│   │   ├── chart/           # Seasonal chart + fundamentals (main feature page)
│   │   ├── explore/         # Market overview dashboard
│   │   ├── watchlist/       # Watchlist with live quotes
│   │   ├── portfolio-tracker/ # Portfolio P&L tracker
│   │   ├── money-flow/      # Institutional money flow reports
│   │   ├── msci/            # MSCI inclusion tracker
│   │   ├── idx-bubbles/     # Full-screen market bubble map
│   │   ├── idx-momentum/    # IDX momentum scanner
│   │   ├── idx-rotation/    # Relative Rotation Graph
│   │   ├── discussion/      # Community chat
│   │   ├── tools/           # Mobile tools menu page
│   │   ├── signin/          # Google sign-in page
│   │   ├── account/         # Redirect stub for OAuth callback (account UI is a sidebar)
│   │   ├── offline/         # PWA offline fallback page
│   │   └── api/
│   │       ├── finance/     # GET: Yahoo Finance OHLCV proxy + logo auto-upload
│   │       ├── quotes/      # POST: Batch quote fetch (up to 50 symbols)
│   │       ├── price-series/  # GET: Price series data
│   │       ├── symbol-search/ # GET: Yahoo Finance symbol search
│   │       ├── fundamentals/  # GET: Stock fundamentals (Yahoo Finance)
│   │       ├── screeners/[category]/  # GET: On-demand screener (idx/us/crypto)
│   │       ├── bubbles/     # GET: Market bubbles data from Supabase
│   │       ├── rotation/    # GET: RRG data from Supabase
│   │       ├── momentum/    # GET: IDX momentum data from Supabase
│   │       ├── money-flow/  # GET: Money flow reports from Supabase
│   │       ├── msci/        # GET: MSCI stock data from Supabase
│   │       ├── discussions/ # GET/POST/DELETE: Chat messages
│   │       ├── delete-account/ # POST: Deletes user and all data
│   │       ├── msci/        # GET: MSCI tracker data
│   │       └── cron/
│   │           ├── [category]/  # GET: Triggers /api/screeners/[category] (cron target)
│   │           └── money-flow/  # GET: Runs full Stockbit money flow analysis (cron target)
│   ├── components/
│   │   ├── ui/              # shadcn/ui components (Button, Card, Dialog, etc.)
│   │   ├── app-layout-client.jsx  # Layout shell: mobile header, desktop navbar, sidebar
│   │   ├── auth-provider.jsx      # Auth context: session, watchlist/portfolio sync
│   │   ├── account-sidebar.jsx    # Slide-out account panel (auth, theme, data, delete)
│   │   ├── desktop-sidebar.jsx    # Desktop left nav
│   │   ├── desktop-navbar.jsx     # Desktop top bar
│   │   ├── mobile-bottom-nav.jsx  # Mobile bottom tab bar
│   │   ├── header-symbol-search.jsx  # Global symbol search dialog
│   │   ├── market-bubbles.jsx     # D3-style bubble visualisation (canvas)
│   │   ├── market-canvas.jsx      # Landing page canvas decoration
│   │   ├── normal-candlestick-chart.jsx  # lightweight-charts wrapper
│   │   ├── money-flow-card.jsx    # Expandable money flow report card
│   │   ├── ticker-avatar.jsx      # Symbol logo with fallback
│   │   ├── trending-marquee.jsx   # Auto-scrolling trending symbols banner
│   │   ├── manage-watchlist-dialog.jsx  # Add/remove/reorder watchlist symbols
│   │   ├── add-asset-modal.jsx    # Add asset to portfolio
│   │   ├── pwa-register.jsx       # Service worker registration
│   │   └── pwa-install-dialog.jsx # PWA install prompt
│   ├── config/              # (empty / reserved)
│   ├── hooks/
│   │   └── use-mobile.js    # Mobile breakpoint detection hook
│   └── lib/
│       ├── api-client.js    # fetchEncodedJson — decodes XOR-encoded API responses
│       ├── secure-payload.js  # XOR cipher encode/decode for API response obfuscation
│       ├── supabase-browser.js  # Singleton browser Supabase client
│       ├── supabase-server.js   # Service role Supabase client + getUserFromRequest
│       ├── yahoo-finance.js     # Configured yahoo-finance2 instance
│       ├── yahoo-raw-log.js     # Dev-only raw response logging
│       ├── money-flow.js        # Stockbit URL builders, score calculation helpers
│       ├── msci-calculations.js # MSCI threshold / progress / target price calculations
│       ├── seasonalData.js      # Seasonal pattern computation (returns, heatmaps)
│       ├── stock-universe.js    # Static IDX / US SP500 / Crypto symbol arrays
│       ├── default-watchlist.js # Default watchlist symbols shown to guests
│       ├── tools-menu.js        # TOOLS_ITEMS config (used by desktop sidebar + tools page)
│       ├── utils.js             # cn(), formatTickerDisplay(), formatMarketCap(), formatPrice(), formatPercent()
│       └── chart-plugins/       # Custom lightweight-charts plugins
```

**Non-standard decisions worth noting:**
- `app/account/page.jsx` is a stub that redirects to `/` — the actual account UI lives in `components/account-sidebar.jsx`.
- `app/manifest.json/route.js` is a Route Handler that generates the PWA manifest dynamically, placed inside a directory named `manifest.json/` which is unconventional.
- All API responses (except `/api/discussions` and `/api/cron/*`) are XOR-obfuscated via `encodePayload()` and must be decoded client-side with `fetchEncodedJson()`. The wrapper key is `payload`.

---

## 4. Features & Pages

### Pages

| Route | Description | Key Components | Supabase Tables |
|---|---|---|---|
| `/` | Landing page with Vanta clouds hero and feature intro | `MarketCanvas`, `AuthProvider` | — |
| `/explore` | Market dashboard: index quotes, global markets, screener results | `TrendingMarquee`, `TickerAvatar`, `MoneyFlowCard` | `screening_snapshots`, `trending_stocks`, `money_flow_reports` |
| `/chart` | Seasonal chart analysis, election cycles, heatmaps, fundamentals, analyst ratings, candlestick chart | `NormalCandlestickChart`, `AddAssetModal`, `SymbolSearchDialog`, `ArunaWatermark` | — (Yahoo Finance via `/api/finance`, `/api/fundamentals`) |
| `/watchlist` | Tracked symbols with live 1D/1W quotes and mini spark charts | `ManageWatchlistDialog`, `TrendingMarquee`, `TickerAvatar` | `watchlists` (via `AuthProvider`) |
| `/portfolio-tracker` | P&L portfolio with pie chart, multi-currency (IDR/USD/SGD) | `PortfolioPie`, `AddAssetModal`, `TickerAvatar` | `portfolios` (via `AuthProvider`) |
| `/money-flow` | Institutional money flow scores by timeframe (weekly/monthly/quarterly) | `MoneyFlowCard`, `TickerAvatar` | `money_flow_reports` |
| `/msci` | MSCI Standard / Small Cap inclusion tracker with free-float progress | `TickerAvatar`, `SegmentControl` | `msci_stocks`, `msci_snapshot_cache` |
| `/idx-bubbles` | Full-screen market bubble map (size = market cap, color = % change) | `MarketBubbles` | `ajaib_stocks` or `bibit_stocks` (via `/api/bubbles`) |
| `/idx-momentum` | IDX EMA-31 momentum scanner — Leading / Watchlist / Lagging tiers | `TickerAvatar` | `screening_snapshots` (via `/api/momentum`) |
| `/idx-rotation` | SVG Relative Rotation Graph (RRG) — Leading/Weakening/Lagging/Improving quadrants | `ArunaWatermark` | `screening_snapshots` (via `/api/rotation`) |
| `/discussion` | Community chat with `$SYMBOL` and `US$SYMBOL` stock mention links, reply threading | — (Supabase Realtime subscription) | `discussion_messages` |
| `/tools` | Mobile-friendly list of all analytical tools | — | — |
| `/signin` | Google OAuth sign-in page | `GoogleGlyph`, `AuthProvider` | — |
| `/offline` | PWA offline fallback | — | — |

### Key Features

- **Seasonal charts:** Historical return patterns computed in `lib/seasonalData.js`. Supports Hirsch-style seasonal patterns, election cycle overlays, monthly/quarterly heatmaps.
- **Fundamentals & analyst ratings:** Fetched server-side via `yahoo-finance2` and returned as encoded JSON. Includes a custom semicircle gauge for analyst recommendation mean.
- **Watchlist/portfolio local-first sync:** Stored in `localStorage`. Synced to Supabase `watchlists` / `portfolios` tables when signed in. Merge strategy handled in `AuthProvider`.
- **Money flow analysis:** Cron job (`/api/cron/money-flow`) authenticates to the private Stockbit API using a bearer token, fetches broker transaction data for each symbol in a screener template, scores accumulation/distribution, and persists results to `money_flow_reports` and `weekly_reports`.
- **Screener cron:** `/api/cron/[category]` triggers `/api/screeners/[category]` which runs a Yahoo Finance EMA-31 momentum scan across IDX / US / Crypto universes and writes to `screening_snapshots`.
- **MSCI tracker:** `msci-calculations.js` computes free-float market cap progress toward MSCI inclusion thresholds ($2B for Standard, $300M for Small Cap). USD/IDR conversion is hardcoded at 15,800.
- **PWA:** Service worker at `public/sw.js`, manifest via `/app/manifest.json/route.js`, install prompt via `PWAInstallDialog`.
- **Appearance mode:** Three modes — default, leaf (natural), and sparkle — managed by `AppearanceModeProvider`.

---

## 5. Database Schema

All tables have RLS enabled. Source of truth: [supabase/setup.sql](supabase/setup.sql).

### User-owned tables (RLS: owner only)

| Table | Primary Key | Notable Columns | Notes |
|---|---|---|---|
| `profiles` | `id` (uuid, FK → auth.users) | `email`, `full_name`, `avatar_url`, `updated_at` | Upserted from auth metadata on sign-in |
| `watchlists` | `user_id` (uuid, FK → auth.users) | `items` (jsonb array), `updated_at` | One row per user; entire list stored as JSON blob |
| `portfolios` | `user_id` (uuid, FK → auth.users) | `entries` (jsonb array), `updated_at` | One row per user; entire portfolio stored as JSON blob |

### Public read / service-role write tables

| Table | Primary Key | Notable Columns | Notes |
|---|---|---|---|
| `stock_universes` | `id` (integer, default 1) | `idx_stocks text[]`, `us_stocks text[]`, `crypto_stocks text[]`, `updated_at` | Single-row lookup table; seeded from `supabase/schema.sql` |
| `screening_snapshots` | `category` (text) | `results` (jsonb), `status`, `next_cursor`, `processed_count`, `total_count`, `metadata` (jsonb) | Stores latest screener pass per category (`idx`, `us`, `crypto`) |
| `trending_stocks` | `(category, symbol)` composite | `order` (integer), `created_at` | Powers the `TrendingMarquee` component |
| `msci_stocks` | `id` (uuid) | `ticker`, `company_name`, `msci_index` (enum: standard/small_cap), `msci_status` (enum: included/watchlist/potential), `free_float_percent`, `shares_outstanding`, `order`, `notes` | Manually seeded; see `supabase/msci_seed.sql` |
| `msci_snapshot_cache` | `ticker` (text) | `price`, `market_cap`, `free_float_mcap`, `last_updated_at` | Refreshed by `/api/msci` on read |
| `ajaib_stocks` | `code` (text) | `name`, `price`, `icon_url`, `market_cap`, `volume`, `price_1_week_*`, `price_1_month_*`, `updated_at` | Snapshot from Ajaib API; used by market bubbles |
| `bibit_stocks` | `id` (integer) | `symbol`, `name`, `price`, `change`, `percent`, `key_stats_*` (many columns), `corp_action_info` (jsonb), `updated_at` | Snapshot from Bibit API; alternate bubbles data source |
| `discussion_messages` | `id` (uuid) | `user_id`, `content` (≤1000 chars), `mentions text[]`, `reply_to_id` (self-FK), `is_system`, `created_at` | Supports threaded replies; `mentions` extracted server-side |
| `money_flow_reports` | `(symbol, report_date, timeframe)` composite | `money_flow_score`, `broker_accdist`, `top1/3/5_percent`, `volume_spike`, `signal`, `score_breakdown` (jsonb), `broker_summary/inventory/cost_analysis/concentration` (jsonb), `absorption_strength`, `accumulation_persistence`, `market_phase`, `manipulation_risk` (jsonb), `screener_snapshot` (jsonb) | Populated by cron; `timeframe` values: `weekly`, `monthly`, `quarterly` |
| `weekly_reports` | `week_start` (date, unique) | `top_picks` (jsonb), `source_count`, `min_score`, `screener_id`, `screener_total_rows`, `metadata` (jsonb) | Weekly summary built from `money_flow_reports` |

---

## 6. Authentication

- **Provider:** Supabase Auth with Google OAuth.
- **Client:** `getSupabaseBrowserClient()` — singleton, browser-only, session persisted under localStorage key `aruna_auth`.
- **Server:** `getSupabaseServiceRoleClient()` — service role, used in API routes for privileged DB access. `getUserFromRequest()` extracts and validates a bearer token from the `Authorization` header.
- **Auth flow:** `signInWithGoogle()` in `AuthProvider` calls `supabase.auth.signInWithOAuth()` with a redirect back to `/account?redirect=<original path>`. The `account/page.jsx` immediately redirects to `/` (the redirect path is handled during the OAuth callback by Supabase).
- **Session state:** Managed by `AuthProvider` context. Subscribes to `onAuthStateChange`. On sign-in, automatically upserts the `profiles` row and fetches remote watchlist/portfolio.

### Protected routes / gating

There is **no server-side route protection in middleware** — the middleware only applies CORS headers to `/api/*`. All access control is:

1. **API-level:** Cron routes check `Authorization: Bearer <CRON_SECRET>`. Delete-account checks for a valid user bearer token.
2. **Client-level:** Certain features (earnings/revenue charts in `/chart`, some money-flow details) are blurred/locked behind a `Lock` icon for unauthenticated users.
3. **RLS:** Supabase RLS policies ensure users can only read/write their own `profiles`, `watchlists`, and `portfolios`.

**No multiple user roles** — the only distinction is authenticated vs. guest users.

---

## 7. Environment Variables

| Variable | Required | Where Used | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Required | Browser + server clients, multiple API routes | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Required | Browser Supabase client, discussions API | Public anon key for client-side auth |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Required | Server API routes (screeners, bubbles, msci, discussions, cron, delete-account) | Never expose to the browser |
| `APP_URL` | ✅ Required | `next.config.mjs` exposes as `NEXT_PUBLIC_APP_URL`; middleware CORS; cron routes | Production base URL, e.g. `https://aruna.app` |
| `NEXT_PUBLIC_APP_URL` | ✅ Required | Middleware CORS allowlist; manifest route; cron base URL resolution | Same value as `APP_URL`; set explicitly or via `next.config.mjs` |
| `SECURE_PAYLOAD_KEY` | ✅ Required | `lib/secure-payload.js` — XOR-obfuscates all API responses | Must match on server and client |
| `CRON_SECRET` | ✅ Required | `api/cron/[category]` and `api/cron/money-flow` — bearer token auth | Used by Vercel cron or external scheduler |
| `STOCKBIT_AUTHORIZATION_BEARER` | ✅ Required (for money flow) | `api/cron/money-flow` — authenticates to private Stockbit API | Bearer token from a Stockbit account session |
| `STOCKBIT_SCREENER_TEMPLATE_ID` | Optional | `api/cron/money-flow` | Defaults to `"5461641"` if unset |
| `API_ALLOWED_ORIGINS` | Optional | `middleware.js` CORS allowlist | Comma-separated list of allowed origins |
| `VERCEL_URL` | Optional (auto-set) | Middleware CORS; cron base URL resolution | Automatically injected by Vercel |
| `NEXT_PUBLIC_APP_NAME` | Optional | `layout.jsx`, `manifest.json/route.js` | Defaults to `"Aruna"` via `next.config.mjs` |
| `NEXT_PUBLIC_APP_VERSION` | Optional | `account-sidebar.jsx` version display | Set to `"1.7.56"` via `next.config.mjs` |

---

## 8. Known Issues & Messy Areas

### Security

- **XOR cipher is not cryptography.** `lib/secure-payload.js` uses a simple XOR with a repeating key. This provides obfuscation only — anyone with the `SECURE_PAYLOAD_KEY` (or who reverse-engineers the pattern) can read all API responses. It is not a substitute for HTTPS or signed JWTs.
- ~~**`HIDUP_JOKOWI` as the API response envelope key.**~~ ✅ Resolved — renamed to `payload`.
- **CORS enforcement is partially commented out in middleware.** The strict origin-blocking (`buildUnauthorizedResponse`) is currently disabled, and the middleware unconditionally passes all requests with CORS headers. This makes the CORS configuration decorative, not protective.
- ~~**`SUPABASE_STORAGE_BASE` is hardcoded.**~~ ✅ Resolved — now derived from `process.env.NEXT_PUBLIC_SUPABASE_URL`.
- **Stockbit API scraping.** The money flow cron authenticates to `https://exodus.stockbit.com` (a private/undocumented API) using a user bearer token. This is fragile and may violate Stockbit's ToS.

### Code Quality & Architecture

- ~~**`formatMarketCap`, `formatPrice`, `formatPercent` are duplicated.**~~ ✅ Resolved — consolidated into `lib/utils.js`; `msci-calculations.js` re-exports.
- **`USD_TO_IDR = 15_800` is hardcoded** in `lib/msci-calculations.js` with a `TODO` comment. Production apps should fetch a live exchange rate.
- **`app/account/page.jsx` is a redirect stub.** Documented — exists for OAuth callback handling. The account UI lives in `components/account-sidebar.jsx`.
- ~~**Empty directories.**~~ ✅ Resolved — `portfolio/` and `settings/` removed.
- ~~**`vercel.json` is `{}`.**~~ ✅ Resolved — cron schedules configured for `idx`, `us`, `crypto`.
- **Money flow cron truncates all existing data** before re-inserting: `supabase.from("money_flow_reports").delete().neq("id", 0)`. This means any failed cron run leaves the table empty.
- ~~**`discussions` API mixes two Supabase clients.**~~ ✅ Resolved — standardized on `createClient(serviceKey)`.
- ~~**Hardcoded Supabase storage URLs.**~~ ✅ Resolved — all URLs now built from `NEXT_PUBLIC_SUPABASE_URL`.
- **`DEFAULT_SCREENER_TEMPLATE_ID = "5461641"`** is hardcoded in the money flow cron. The env var `STOCKBIT_SCREENER_TEMPLATE_ID` overrides it, but the magic number is not documented.
- ~~**Landing page Vanta.js scripts never removed on unmount.**~~ ✅ Resolved — cleanup function added to `useEffect`.
- ~~**No `vercel.json` cron configuration.**~~ ✅ Resolved.

---

## 9. Getting Started

### Prerequisites

- Node.js 18+ (20 LTS recommended)
- A Supabase project
- (Optional) A Stockbit account for the money flow cron

### 1. Clone and install

```bash
git clone <repo-url>
cd aruna
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# App URL (use http://localhost:3000 for local dev)
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API response obfuscation key (any random string)
SECURE_PAYLOAD_KEY=change-me-to-something-random

# Cron job secret (any random string)
CRON_SECRET=change-me-to-something-random

# Stockbit bearer token (required only for money flow cron)
STOCKBIT_AUTHORIZATION_BEARER=<your-stockbit-bearer-token>
STOCKBIT_SCREENER_TEMPLATE_ID=5461641   # optional, this is the default
```

### 3. Set up Supabase

1. Create a new Supabase project.
2. In the SQL Editor, run the complete setup file (schema + migrations + seed data):
   ```
   supabase/setup.sql
   ```
3. Enable **Google** as an OAuth provider under **Authentication → Providers**. Set the redirect URL to:
   ```
   http://localhost:3000/  (for dev)
   https://<your-domain>/  (for production)
   ```

### 4. Run development server

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

### 5. Trigger cron jobs manually (development)

The screener and money flow crons are not auto-scheduled in development. Trigger them manually with `curl` or a REST client:

```bash
# Trigger IDX screener
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/idx

# Trigger US screener
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/us

# Trigger money flow analysis
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/money-flow
```

### 6. Build for production

```bash
npm run build
npm start
```

### Deploying to Vercel

1. Set all environment variables in the Vercel project settings.
2. Cron schedules are already configured in `vercel.json`. Review and adjust timing as needed.
3. Ensure `CRON_SECRET` is set in Vercel environment variables — Vercel sends it automatically as `Authorization: Bearer <CRON_SECRET>` for cron jobs.

---

## 10. API Documentation

An exported API collection (`aruna-api.json`) is included in the project root. It is formatted as a Postman v2.1.0 collection and can be natively imported into [Bruno](https://www.usebruno.com/), Postman, or Insomnia.

### How to use with Bruno:
1. Open Bruno.
2. Click **Import Collection** and select the `aruna-api.json` file.
3. Configure the **Local** environment variables:
   - `BASE_URL`: `http://localhost:3000` (or your production URL)
   - `CRON_SECRET`: Must match your `.env.local` for cron jobs to succeed
4. Add your Supabase session cookie (`sb-access-token`) in the Headers tab for routes under the **Community** or **Account** folders if you need to test authenticated mutations.

**Important Note on Payloads:**
By design, all JSON responses from `/api/*` (except `discussions` and `cron`) are XOR-encoded using the `SECURE_PAYLOAD_KEY` and returned inside a `{"payload": "..."}` envelope. The documentation in the collection shows the **decoded structure** to help you understand the data schema.

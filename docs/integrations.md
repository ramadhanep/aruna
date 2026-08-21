# Integrations

## Yahoo Finance

**Purpose**: Market data (quotes, OHLCV charts, fundamentals, symbol search).

**Integration**: `yahoo-finance2` npm package.

**Endpoints used**:
- `yahoo-finance.chart()` — OHLCV price series.
- `yahoo-finance.quote()` — Current price, metadata, logo URL.
- `yahoo-finance.quoteSummary()` — Fundamentals, earnings, analyst ratings.
- `yahoo-finance.search()` — Symbol/company search.

**Rate limiting**: No explicit rate limiting configured. Concurrency limited to 10 simultaneous requests in `/api/quotes`.

**Error handling**: API errors return 404 (no data) or 500 (server error).

**Logging**: Dev-only raw response logging via `writeYahooRawLog()` to `logs/yahoo/` directory.

## Bybit (Public Market Data)

**Purpose**: Fast, keyless crypto quotes and klines for `*-USD`/`*-USDT` symbols.

**Integration**: Direct REST calls to `https://api.bybit.com/v5/market/*` via `src/lib/bybit.js`. No API key — public endpoints only.

**Endpoints used**:
- `GET /v5/market/kline` — spot candles; mapped to the same payload shapes as Yahoo (`fetchBybitQuotePayload`, `fetchBybitSeriesPayload`).

**Symbol handling**: both `BTC-USD` (Yahoo style) and `BTCUSDT` (native) are accepted everywhere; `formatTickerDisplay()` renders crypto as native (`BTCUSDT`). Unknown pairs throw and callers fall back to Yahoo.

**Realtime**: `/api/quotes` and `/api/finance` always fetch crypto live from Bybit — crypto rows never enter the response cache.

**Limits**: 1000-candle cap per kline request (no pagination); 8 s fetch timeout.

## Supabase

**Purpose**: Authentication, PostgreSQL database, file storage.

**Integration**: `@supabase/supabase-js` npm package.

**Services used**:
- **Auth**: Google OAuth sign-in/sign-out, session management.
- **Database**: All tables via `supabase.from().select()/insert()/upsert()/delete()`.
- **Storage**: Two buckets (`us` for US stock logos, `idx` for IDX stock logos).

**Clients**:
- Browser: `getSupabaseBrowserClient()` — anon key, client-side auth.
- Server: `getSupabaseServiceRoleClient()` — service role key, privileged access.

## Stockbit (Private API)

**Purpose**: Broker transaction data for institutional money flow analysis.

**Integration**: Direct HTTP fetch in `/api/cron/money-flow`.

**Endpoints**:
- `https://exodus.stockbit.com` — Various broker transaction data endpoints.
- URL builders in `lib/money-flow.js`.

**Authentication**: Bearer token from `STOCKBIT_AUTHORIZATION_BEARER` env var (obtained from a Stockbit user session).

**Status**: Fragile — uses undocumented/private API. May violate Stockbit's ToS.

**Data processed**: Broker accumulation/distribution, volume spikes, price data, screener templates.

## Pluang CDN

**Purpose**: Source for US stock logo SVGs.

**Integration**: HTTP fetch in `/api/finance` and `/api/quotes` via the shared
server-side cache helper `ensureUsLogo()` in `@/lib/logo-cache.js`.

**Flow**:
1. Check if logo exists in Supabase storage (`us/<symbol>.svg`).
2. If missing, download from `https://image-cdn.pluang.com/icons/light/global-stocks/<symbol>.svg`.
3. Upload to Supabase storage with upsert for future use.

**Configuration**: The CDN base is a stable code constant
(`PLUANG_CDN_BASE`) in `@/lib/supabase-storage.js`, not an env variable — a
provider change is a code change. The Supabase storage base is derived from the
existing `NEXT_PUBLIC_SUPABASE_URL` env var in the same module and shared by
all routes/components via `SUPABASE_STORAGE_BASE`, `getIdxLogoUrl()`, and
`getUsLogoUrl()`. No new env surface.

## Ajaib API

**Purpose**: IDX stock snapshots for the market bubble map.

**Integration**: Data stored in Supabase `ajaib_stocks` table (populated externally or via API).

**Usage**: `/api/bubbles` reads from this table.

## Bibit API

**Purpose**: Alternative IDX stock data source.

**Integration**: Data stored in Supabase `bibit_stocks` table.

**Usage**: Alternative data source for bubble map.

## Vercel

**Purpose**: Hosting, serverless functions, cron scheduling.

**Integration**: `vercel.json` for cron configuration. `public/_headers` for service worker headers.

## No Longer Active

- **Vanta.js** (CDN) — Previously used for animated cloud background on landing page. Code cleanup added to remove on unmount. The landing page now redirects to `/explore`.

## Third-Party Code Considerations

- All external API calls go through Next.js API routes (server-side), never directly from the browser.
- API keys are server-side environment variables.
- XOR obfuscation wraps API responses (not for security, just obfuscation).

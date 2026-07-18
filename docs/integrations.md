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

**Integration**: HTTP fetch in `/api/finance` and `/api/quotes`.

**Flow**:
1. Check if logo exists in Supabase storage (`us/<symbol>.svg`).
2. If missing, download from `https://image-cdn.pluang.com/icons/light/global-stocks/<symbol>.svg`.
3. Upload to Supabase storage with upsert for future use.

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

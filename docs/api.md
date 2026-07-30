# API

## Architecture

All API routes are Next.js [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) living in `src/app/api/*`.

- **HTTP methods**: GET, POST, DELETE as appropriate.
- **Request parsing**: `new URL(request.url).searchParams` for GET; `request.json()` for POST.
- **Response format**: JSON wrapped in `{ payload: "<xor-encoded-base64>" }` (exceptions below).
- **Status codes**: 200 (success), 400 (validation), 404 (not found), 500 (server error).

## Response Encoding

All API responses (except `/api/cron/*`) are XOR-obfuscated. This includes `/api/discussions`.

```
Server: encodePayload(data) → base64(xor(json, key))
Client: fetchEncodedJson(url) → decodeApiResponse(body) → data
```

Key: `SECURE_PAYLOAD_KEY` environment variable (must match on server and client).

## Base URL

- Development: `http://localhost:3000`
- Production: `https://aruna.app` (configurable via `APP_URL`)

## Market Data Endpoints

### `GET /api/finance`

Yahoo Finance OHLCV proxy with logo auto-upload.

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| symbol | string | ✅ | — | Stock symbol (e.g., `BBCA.JK`) |
| startDate | number | ✅ | — | Unix timestamp (seconds) |
| endDate | number | ✅ | — | Unix timestamp (seconds) |
| interval | string | ❌ | `1d` | Valid: `1m`,`2m`,`5m`,`15m`,`30m`,`60m`,`90m`,`1h`,`1d`,`5d`,`1wk`,`1mo`,`3mo` |
| events | string | ❌ | — | `div\|split\|earn` |
| includePrePost | boolean | ❌ | `false` | Include pre/post market data |

Response: `{ prices[], events?, meta }`

### `POST /api/quotes`

Batch quote fetch (up to 50 symbols) with mini-chart data.

| Body Field | Type | Required | Description |
|---|---|---|---|
| symbols | string[] | ✅ | Array of symbols (max 50) |
| timeframe | string | ❌ | `1D`, `1W`, `1M`, `3M`, `YTD`, `1Y`, `2Y`, `5Y`, `ATH` |

Response: `{ quotes: { [symbol]: { price, change, changePercent, chartData[], chartTimestamps[], logo, meta } }, meta }`

### `GET /api/price-series`

Price series data with multiple timeframe support.

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| symbol | string | ✅ | — | Stock symbol |
| timeframe | string | ❌ | `D` | `15M`, `1H`, `2H`, `4H`, `D`, `W`, `M` |
| range | string | ❌ | `D` | Alias for timeframe |

Response: `{ data: [{ timestamp, date, price, open, high, low, close, volume }], meta }`

### `GET /api/symbol-search`

Yahoo Finance symbol search.

| Param | Type | Required | Description |
|---|---|---|---|
| q | string | ✅ | Search query (min 1 char) |

Response: `{ symbols: [{ symbol, name, exchange, type }], source }`

### `GET /api/fundamentals`

Stock fundamentals, earnings, analyst ratings.

| Param | Type | Required | Description |
|---|---|---|---|
| symbol | string | ✅ | Stock symbol |

Response: `{ profile, price, fundamentals, earnings, recommendationTrend, upgradeDowngradeHistory, calendarEvents }`

## Analytics Endpoints

### `GET /api/bubbles`

Market bubble map data.

| Param | Type | Required | Description |
|---|---|---|---|
| market | string | ❌ | `idx` (default) |

Response: `[{ code, name, price, market_cap, price_1_week_pct_change, ... }]`

### `GET /api/rotation`

Relative Rotation Graph (RRG) data.

Response: `[{ symbol, rs_ratio, rs_momentum, quadrant }]`

### `GET /api/momentum`

IDX momentum scanner results.

Response: `[{ symbol, momentumScore, status, logo_url }]`

### `GET /api/money-flow`

Institutional money flow reports.

| Param | Type | Required | Description |
|---|---|---|---|
| symbol | string | ❌ | Filter by symbol |

Response: `{ symbol?, reports: [{ timeframe, money_flow_score, signal, broker_accdist, ... }] }`

### `GET /api/msci`

MSCI inclusion tracker data.

Response: `{ standard: [{ ticker, free_float_mcap, msci_status, ... }], small_cap: [...] }`

## Screener Endpoints

### `GET /api/screeners/:category`

Get screener results by market category.

| Param | Description |
|---|---|
| category | `idx`, `us`, or `crypto` |

Response: `{ data: [{ symbol, momentum, ... }], metadata }`

## Community Endpoints

### `GET /api/discussions`

Get discussion messages. XOR-encoded like other endpoints.

| Query Param | Description |
|---|---|
| symbol | Filter by stock symbol mention |

### `POST /api/discussions`

Post a message. Requires an authenticated Supabase session (cookie-based, via `@supabase/ssr`'s `createServerClient()` — not a Bearer token).

| Body Field | Type | Required | Description |
|---|---|---|---|
| content | string | ✅ | Max 1000 chars |
| mentions | string[] | ❌ | Stock symbols mentioned |
| reply_to_id | string (uuid) | ❌ | Parent message ID |

### `DELETE /api/discussions`

Delete own message. Same cookie-session auth as `POST`.

| Query Param | Description |
|---|---|
| id | Message UUID to delete |

## Account Endpoints

### `POST /api/delete-account`

Delete user account and all data. Requires Bearer token.

| Header | Value |
|---|---|
| Authorization | `Bearer <supabase_access_token>` |

Response: `{ success: true, message: "..." }`

## Cron Endpoints (Plain JSON)

### `GET /api/cron/:category`

Trigger screener for a market category.

| Param | Description |
|---|---|
| category | `idx`, `us`, or `crypto` |

### `GET /api/cron/money-flow`

Trigger full Stockbit money flow analysis.

Both require `Authorization: Bearer <CRON_SECRET>`.

## HTTP Client (Browser)

**`fetchEncodedJson(url, init?)`** from `@/lib/api-client.js`:

```javascript
import { fetchEncodedJson } from '@/lib/api-client';

const { response, data } = await fetchEncodedJson('/api/finance?symbol=BBCA.JK');
// data = decoded response body
```

## Error Handling

All errors return:
```json
{
  "payload": "<xor-encoded>"
  // decoded: { "error": "Descriptive error message" }
}
```

Common error statuses:
- **400**: Missing or invalid parameters.
- **404**: Symbol not found or no data available.
- **500**: Internal server error or external API failure.

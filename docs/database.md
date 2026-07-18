# Database

## Platform

**Supabase PostgreSQL** — managed database with Row Level Security (RLS).

## Schema Source of Truth

`supabase/setup.sql` — contains all table definitions, RLS policies, indexes, and seed data.

## Table Overview

### User-Owned Tables (RLS: owner only)

| Table | PK | Notable Columns | Description |
|---|---|---|---|
| `profiles` | `id` (uuid, FK→auth.users) | `email`, `full_name`, `avatar_url`, `updated_at` | Upserted from auth metadata on sign-in |
| `watchlists` | `user_id` (uuid, FK→auth.users) | `items` (jsonb[]), `updated_at` | One row per user; full list as JSON |
| `portfolios` | `user_id` (uuid, FK→auth.users) | `entries` (jsonb[]), `updated_at` | One row per user; full portfolio as JSON |

### Public Read / Service-Role Write Tables

| Table | PK | Description |
|---|---|---|
| `stock_universes` | `id` (integer, default 1) | Symbol arrays for IDX, US, Crypto (single row) |
| `screening_snapshots` | `category` (text) | EMA-31 screener results per category |
| `trending_stocks` | `(category, symbol)` | Trending stocks for marquee component |
| `msci_stocks` | `id` (uuid) | MSCI stocks with index type and status |
| `msci_snapshot_cache` | `ticker` (text) | Cached prices for MSCI calculation |
| `ajaib_stocks` | `code` (text) | IDX stock snapshot from Ajaib API |
| `bibit_stocks` | `id` (integer) | Alternative IDX snapshot from Bibit API |
| `discussion_messages` | `id` (uuid) | Chat messages with threading |
| `money_flow_reports` | `(symbol, report_date, timeframe)` | Institutional money flow scores |
| `weekly_reports` | `week_start` (date) | Weekly summary of money flow picks |

## Key Relationships

```
auth.users
  ├── profiles (1:1, id FK)
  ├── watchlists (1:1, user_id FK)
  ├── portfolios (1:1, user_id FK)
  └── discussion_messages (1:N, user_id FK)

discussion_messages
  └── self-reference (reply_to_id → id) for threading

msci_stocks
  └── msci_snapshot_cache (1:N, ticker → price data)

money_flow_reports
  └── weekly_reports (reference via week_start)
```

## RLS Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | OWNER | OWNER | OWNER | OWNER |
| `watchlists` | OWNER | OWNER | OWNER | OWNER |
| `portfolios` | OWNER | OWNER | OWNER | OWNER |
| `stock_universes` | PUBLIC | SERVICE | SERVICE | SERVICE |
| `screening_snapshots` | PUBLIC | SERVICE | SERVICE | SERVICE |
| `trending_stocks` | PUBLIC | SERVICE | SERVICE | SERVICE |
| `msci_stocks` | PUBLIC | SERVICE | SERVICE | SERVICE |
| `msci_snapshot_cache` | PUBLIC | SERVICE | SERVICE | SERVICE |
| `ajaib_stocks` | PUBLIC | SERVICE | SERVICE | SERVICE |
| `bibit_stocks` | PUBLIC | SERVICE | SERVICE | SERVICE |
| `discussion_messages` | PUBLIC | AUTH | N/A | OWNER |
| `money_flow_reports` | PUBLIC | SERVICE | SERVICE | SERVICE |
| `weekly_reports` | PUBLIC | SERVICE | SERVICE | SERVICE |

## Data Access Patterns

### Client (Browser)
```javascript
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const supabase = getSupabaseBrowserClient();
const { data } = await supabase.from('watchlists').select('items').eq('user_id', user.id).maybeSingle();
```

### Server (API Route)
```javascript
import { getSupabaseServiceRoleClient } from '@/lib/supabase-server';

const supabase = getSupabaseServiceRoleClient();
const { data } = await supabase.from('screening_snapshots').select('*');
```

## Storage

Two Supabase Storage buckets:

| Bucket | Contents | Source |
|---|---|---|
| `us` | US stock logos (SVG) | Auto-uploaded from Pluang CDN on first request |
| `idx` | IDX stock logos (PNG) | Manually seeded |

Storage URLs are built dynamically:
```javascript
const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/idx/BBCA.png`;
```

## Migration Strategy

- No formal migration tool (no Prisma, Drizzle, etc.).
- Schema changes are applied directly in Supabase SQL Editor.
- `supabase/setup.sql` is the source of truth and should be re-runnable.
- Tables are dropped and recreated if they exist (`DROP TABLE IF EXISTS`).
- Seed data is included in `setup.sql`.

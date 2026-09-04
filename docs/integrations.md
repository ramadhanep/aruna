# Integrations

## Yahoo Finance

- Market data, fundamentals, symbol search
- Accessed through `yahoo-finance2`
- Used only from server routes

## Supabase

- Auth
- Database
- Storage
- Browser client for UI, service-role client for API routes

## Stockbit

- Money flow data
- Private and fragile
- Used only from cron route

## Pluang CDN

- US stock logos
- Cached into Supabase storage

## Ajaib and Bibit

- Market bubble data sources
- Stored in Supabase tables

## Vercel

- Hosting
- Cron scheduling
- Serverless runtime

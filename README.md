# Aruna

Aruna is a mobile-first stock market analysis app for retail investors tracking IDX, US equities, and crypto.

It brings together:
- seasonal chart analysis
- institutional money flow signals
- MSCI inclusion tracking
- momentum screening
- market bubble maps
- watchlist and portfolio tracking
- community discussion

The app focuses on IDX, US equities, and crypto. It is built as a local-first PWA with optional Supabase sync for signed-in users.

## Why it exists

Retail investors usually have to jump between multiple tools to answer simple questions:
- what is the trend doing seasonally
- where is institutional money flowing
- which names are close to MSCI inclusion
- what is moving now across IDX, US, and crypto
- what do I already own or watch

Aruna puts those workflows in one place.

## What you can do

- scan market trends with seasonal charts and fundamentals
- track money flow reports and EMA-31 screeners
- monitor MSCI Standard / Small Cap progress
- compare movers with bubble maps and rotation views
- keep a watchlist and portfolio
- discuss symbols in the community chat
- install the app as a PWA and use it on mobile

## Stack

- Next.js 16 App Router
- React 19
- Supabase
- Tailwind CSS v4
- Vitest
- Playwright

## Architecture

- App routes live in `src/app/`
- Shared UI lives in `src/components/`
- Shared logic lives in `src/lib/`
- API routes proxy external data through the server
- API responses are encoded, except cron routes
- Watchlist and portfolio default to localStorage, then optionally sync to Supabase

## Main Areas

- `/explore` - market dashboard
- `/chart` - seasonal charts, fundamentals, and analyst data
- `/watchlist` - tracked symbols and live quotes
- `/portfolio-tracker` - holdings and P&L tracking
- `/money-flow` - broker transaction flow analysis
- `/msci` - MSCI tracker
- `/idx-bubbles` - bubble map for market breadth
- `/idx-rotation` - relative rotation graph
- `/idx-momentum` - momentum scanner
- `/discussion` - community chat

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:e2e
```

## Docs

- `docs/README.md`
- `docs/architecture.md`
- `docs/api.md`
- `docs/database.md`
- `docs/authentication.md`
- `docs/testing.md`
- `CONTRIBUTING.md`
- `OPENCODE.md`

## Contributing

Open a small PR, keep the layer flow intact, and run lint + tests before submitting.

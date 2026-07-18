# Project Overview

## Purpose

Aruna is a stock market analysis platform for Indonesian retail investors. It aggregates data from Yahoo Finance, Stockbit, Ajaib, and Bibit, runs automated screeners, and presents analysis in a mobile-first progressive web app.

## Target Users

Indonesian retail stock traders and investors tracking IDX (Indonesia Stock Exchange), US equities, and crypto assets.

## Core Features

- **Seasonal Charts** — Historical return patterns with election-cycle overlays, monthly/quarterly heatmaps.
- **Institutional Money Flow** — Broker transaction scoring from Stockbit data (accumulation/distribution signals).
- **MSCI Tracker** — Free-float market cap progress toward MSCI Standard ($2B) and Small Cap ($300M) inclusion.
- **Relative Rotation Graph (RRG)** — Sector rotation visualization with leading/weakening/lagging/improving quadrants.
- **Market Bubble Map** — Canvas-based bubble visualization sized by market cap, colored by price change.
- **Watchlist & Portfolio** — Local-first with optional Supabase cloud sync across devices.
- **Community Discussion** — Real-time chat with stock symbol mentions (`$SYMBOL`, `US$SYMBOL`).
- **EMA-31 Momentum Scanner** — Automated screening for IDX, US, and crypto markets via Yahoo Finance.
- **Supercharts** — Candlestick charts with Heikin Ashi, line modes, fundamentals, and analyst ratings.

## Implementation Status

**Active development / production-ready core features.**

| Area | Status |
|---|---|
| Market data APIs (Yahoo Finance proxy) | Production |
| Seasonal charts & fundamentals | Production |
| Watchlist (local + cloud sync) | Production |
| Portfolio tracker (multi-currency) | Production |
| Money flow analysis | Production (cron-dependent) |
| MSCI tracker | Production (manual seed data) |
| Market bubbles | Production (Ajaib/Bibit snapshots) |
| Momentum scanner | Production (cron-dependent) |
| RRG rotation chart | Production |
| Community chat | Production |
| PWA support | Production |
| Landing page | Production |
| Pricing & trial gating | In development |
| Mobile app (Flutter) | Discontinued / archive |

## Business Goals

- Provide retail investors with institutional-grade analysis tools.
- Aggregate scattered market data (Yahoo, Stockbit, Ajaib, Bibit) into one interface.
- Build community around Indonesian stock analysis.
- Monetize via subscription (pricing page exists, not fully active).

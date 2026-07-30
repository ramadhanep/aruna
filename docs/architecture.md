# Architecture

## High-Level Architecture

Aruna is a **Next.js 16 App Router** application with:

- **API Routes** — Server-side proxy to Yahoo Finance, Supabase CRUD, cron job endpoints.
- **React Server Components (default)** — Pages are server components unless they need interactivity.
- **Client Components** — Marked with `"use client"` for interactivity, state, and browser APIs.
- **Supabase** — Auth provider (Google OAuth), PostgreSQL database, file storage (stock logos).
- **Vercel** — Hosting, cron job scheduling, serverless functions.

```
┌─────────────────────────────────────────────────────┐
│                    Browser (PWA)                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │             Next.js App Router                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │ │
│  │  │  Pages   │  │Components│  │  API Routes   │  │ │
│  │  │ (Server) │  │ (Client) │  │  (Server)     │  │ │
│  │  └──────────┘  └──────────┘  └───────┬───────┘  │ │
│  └───────────────────────────────────────┼─────────┘ │
│                                          │           │
└──────────────────────────────────────────┼───────────┘
                                           │
              ┌────────────────────────────┼────────────────────┐
              │                            │                     │
              ▼                            ▼                     ▼
     ┌─────────────────┐       ┌──────────────────┐     ┌──────────┐
     │   Yahoo Finance  │       │    Supabase      │     │ Stockbit │
     │   (yahoo-fin2)   │       │ ┌──────────────┐│     │ (private)│
     │   Price/quote    │       │ │  PostgreSQL  ││     │ Money    │
     │   fundamentals   │       │ │  Auth (OAuth)││     │ Flow API │
     │   search         │       │ │  Storage     ││     └──────────┘
     └─────────────────┘       │ └──────────────┘│
                                └──────────────────┘
```

## Application Layers

### 1. Presentation Layer — `src/app/*` (Pages & API Routes)

- **Pages** — Route-based React components. Server components by default; client components when interactivity needed.
- **API Routes** — Next.js Route Handlers. Serve as proxy to external APIs and Supabase.
- **Layout** — Single root layout in `src/app/layout.jsx` wrapping all pages.

### 2. Component Layer — `src/components/*`

- **UI Components** — `src/components/ui/` — shadcn/ui primitives (Button, Card, Dialog, etc.).
- **Application Components** — `src/components/` — Auth provider, layout shell, market visualizations, PWA components.

### 3. Library Layer — `src/lib/*`

- **API Client** — `api-client.js` — Fetch wrapper that decodes XOR-obfuscated responses.
- **Business Logic** — `money-flow.js`, `msci-calculations.js`, `seasonalData.js`, `portfolio-metrics.js` — Calculation helpers.
- **Data Access** — `supabase-browser.js`, `supabase-server.js`, `portfolio-storage.js` — Supabase client singletons and localStorage portfolio adapter.
- **Utilities** — `utils.js` — Formatting, class merging, color generation.
- **Configuration** — `stock-universe.js`, `default-watchlist.js`, `tools-menu.js` — Static data.

### 4. Infrastructure Layer — External Services

- **Yahoo Finance** — Market data via `yahoo-finance2` package.
- **Supabase** — Auth, database, storage.
- **Stockbit** — Private API for money flow data (cron job).
- **Pluang CDN** — US stock logo source (auto-cached to Supabase storage).
- **Vercel** — Hosting, serverless functions, cron scheduling.

## Dependency Flow

```
Pages (src/app/*) ──► Components (src/components/*) ──► Lib (src/lib/*)
       │                                                      │
       └────── API Routes ──────► Lib (supabase-server, yahoo-finance, secure-payload)
```

- Pages import components and lib utilities.
- API routes import lib utilities directly.
- Components never import API route modules directly — they use `fetch()` or `fetchEncodedJson()`.
- Lib layer has no dependencies on components or pages.

## Module Boundaries

| Module | Responsibility | May Import From |
|---|---|---|
| `src/app/*/page.jsx` | Page rendering, layout | Components, lib |
| `src/app/api/*/route.js` | HTTP handlers, data fetching | Lib only |
| `src/components/ui/*` | Design system primitives | `@/lib/utils` |
| `src/components/*` | Feature components | UI components, lib |
| `src/lib/*` | Business logic, data access | External packages only |
| `src/hooks/*` | React hooks | React, lib |
| `src/middleware.js` | Request interception | Next.js only |

## Design Philosophy

1. **API as proxy** — All external API calls go through Next.js API routes, never from the browser directly.
2. **Response obfuscation** — All API responses (except discussions and cron) are XOR-encoded with `SECURE_PAYLOAD_KEY` to prevent casual inspection.
3. **Local-first** — Watchlist and portfolio default to `localStorage`. Cloud sync via Supabase is optional.
4. **Mobile-first** — Layout adapts from mobile to desktop. PWA support for installability.
5. **Minimal dependencies** — Avoids heavy state management libraries; uses React Context for auth, localStorage for persistence.

# Tech Stack

## Framework & Runtime

| Technology | Version | Role |
|---|---|---|
| Next.js | ^16.0.8 | App Router, API routes, SSR/SSG |
| React | 19.2.0 | UI framework |
| Node.js | 18+ (20 LTS recommended) | Runtime |

## Backend / Database

| Package | Version | Role |
|---|---|---|
| `@supabase/supabase-js` | ^2.79.0 | Auth, database, storage client |
| `@supabase/ssr` | ^0.8.0 | SSR-safe Supabase client |
| `yahoo-finance2` | ^3.14.3 | Market data (quotes, charts, fundamentals, search) |
| Supabase (platform) | — | PostgreSQL database, Auth (Google OAuth), file storage |

## UI & Styling

| Package | Version | Role |
|---|---|---|
| Tailwind CSS | ^4 | Utility-first CSS |
| `@tailwindcss/postcss` | ^4 | PostCSS integration for Tailwind |
| `tw-animate-css` | ^1.4.0 | Animation utilities (fade, slide, zoom) |
| `next-themes` | ^0.4.6 | Dark/light/system theme switching |
| `lucide-react` | ^0.548.0 | Icon set |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `clsx` | ^2.1.1 | Conditional class names |
| `tailwind-merge` | ^3.3.1 | Tailwind class merging |
| Radix UI (various) | various | Headless accessible UI primitives |

### Radix UI Components Used

- `@radix-ui/react-accordion`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-label`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-select`
- `@radix-ui/react-separator`
- `@radix-ui/react-slot`
- `@radix-ui/react-tooltip`

## Charts & Data Visualization

| Package | Version | Role |
|---|---|---|
| `recharts` | ^2.15.4 | Area, bar, composed, heatmap charts |
| `lightweight-charts` | ^5.0.9 | TradingView-style candlestick/line charts |

## Development & Build

| Tool | Version / Config | Role |
|---|---|---|
| ESLint | ^9 | Linting (`eslint-config-next` for Next.js rules) |
| PostCSS | (via `@tailwindcss/postcss`) | CSS processing |
| npm | (package manager) | Dependency management |
| `jsconfig.json` | `@/*` → `./src/*` | Path aliases |

## Infrastructure

| Service | Purpose |
|---|---|
| Vercel | Hosting, serverless functions, cron jobs |
| Supabase | PostgreSQL database, Auth, Storage |
| Yahoo Finance | Market data (via `yahoo-finance2`) |
| Stockbit | (Private API) Broker transaction data for money flow |
| Pluang CDN | US stock SVG logos |
| Ajaib API | IDX stock snapshots for bubble map |
| Bibit API | IDX stock snapshots (alternative data source) |

## PWA

| Asset | Location |
|---|---|
| Service Worker | `public/sw.js` |
| Manifest | `/manifest.json` (dynamic Route Handler at `src/app/manifest.json/route.js`, not under `/api/`) |
| Offline page | `/offline` |
| App icons | `/aruna.png` (multi-size via manifest) |

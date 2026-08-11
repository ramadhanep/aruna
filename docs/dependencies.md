# Dependencies

## Production Dependencies

| Package | Version | Why It Exists | Where Used |
|---|---|---|---|
| `next` | ^16.0.8 | Framework — routing, SSR, API routes | Everywhere |
| `react` / `react-dom` | 19.2.0 | UI framework | Everywhere |
| `@supabase/supabase-js` | ^2.79.0 | Supabase client (auth, DB, storage) | `lib/supabase-browser.js`, `lib/supabase-server.js` |
| `@supabase/ssr` | ^0.8.0 | SSR-safe Supabase client — actively used | `src/app/api/discussions/route.js` (`createServerClient()` for cookie-session auth on POST/DELETE) |
| `yahoo-finance2` | ^4.0.0 | Market data — quotes, charts, fundamentals, search | `/api/finance`, `/api/quotes`, `/api/price-series`, `/api/fundamentals`, `/api/symbol-search`, `/api/screeners` |
| `tailwindcss` | ^4 | Utility-first CSS framework | All components |
| `@tailwindcss/postcss` | ^4 | PostCSS integration for Tailwind | `postcss.config.mjs` |
| `tw-animate-css` | ^1.4.0 | Animation utilities (fade, slide, zoom) | `globals.css` |
| `next-themes` | ^0.4.6 | Dark/light/system theme switching | `components/theme-provider.jsx` |
| `lucide-react` | ^0.548.0 | Icon set | All components |
| `recharts` | ^2.15.4 | Area, bar, composed, heatmap charts | Chart page, portfolio pie |
| `lightweight-charts` | ^5.0.9 | TradingView-style candlestick charts | `components/normal-candlestick-chart.jsx` |
| `class-variance-authority` | ^0.7.1 | Component variant classes | `components/ui/button.jsx`, `components/ui/label.jsx` |
| `clsx` | ^2.1.1 | Conditional class name construction | `lib/utils.js` (via `cn()`) |
| `tailwind-merge` | ^3.3.1 | Tailwind class conflict resolution | `lib/utils.js` (via `cn()`) |
| Radix UI primitives (8 packages) | various | Headless accessible UI primitives | `components/ui/` (dialog, dropdown, select, etc.) |

### Radix UI Packages

| Package | Component |
|---|---|
| `@radix-ui/react-accordion` | Accordion |
| `@radix-ui/react-dialog` | Dialog, Sheet |
| `@radix-ui/react-dropdown-menu` | Dropdown Menu |
| `@radix-ui/react-label` | Label |
| `@radix-ui/react-radio-group` | Radio Group |
| `@radix-ui/react-select` | Select |
| `@radix-ui/react-separator` | Separator |
| `@radix-ui/react-slot` | Slot (asChild pattern) |
| `@radix-ui/react-tooltip` | Tooltip |

## Dev Dependencies

| Package | Version | Why It Exists |
|---|---|---|
| `eslint` | ^9 | Linting |
| `eslint-config-next` | ^16.0.1 | Next.js ESLint rules |

## Non-NPM Dependencies (External Services)

| Service | Purpose | Integration Point |
|---|---|---|
| Supabase | Auth, database, file storage | `supabase-browser.js`, `supabase-server.js`, multiple API routes |
| Yahoo Finance | Market data | `yahoo-finance2` package |
| Stockbit (private API) | Broker transaction data for money flow | `/api/cron/money-flow` |
| Pluang CDN | US stock SVG logos | `/api/finance`, `/api/quotes` |
| Ajaib API | IDX stock snapshots | `/api/bubbles` (via Supabase) |
| Bibit API | Alternative IDX stock data | `/api/bubbles` (via Supabase) |

## Adding New Dependencies

Before adding a new dependency:
1. Can the feature be implemented with existing dependencies?
2. Can native browser APIs replace it?
3. Is the dependency actively maintained? Check for security issues.

Update `docs/dependencies.md` when adding or removing dependencies.

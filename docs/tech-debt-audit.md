# Tech Debt & Performance Audit

> **Date**: 2026-09-04  
> **Scan scope**: Full codebase — components, API routes, hooks, lib, pages, service worker  
> **Goal**: Step-by-step cleanup for speed and maintainability

---

## Priority Legend

- **P0** — Critical, directly impacts user-perceived speed or causes bugs
- **P1** — High, significant perf or maintainability hit
- **P2** — Medium, worth fixing but not urgent
- **P3** — Low, nice-to-have cleanup

---

## 1. REACT RENDERING (P0)

### 1.1 Zero `React.memo` in entire codebase

No component uses `React.memo`. Every list item re-renders on any parent state change.

**High-impact candidates:**

| Component | File | Why |
|---|---|---|
| `TickerRow` | `src/components/ticker-row.jsx:10` | Rendered in loops (watchlist, explore) with 7+ props |
| `TickerAvatar` | `src/components/ticker-avatar.jsx:8` | Rendered per-stock in multiple lists |
| `MiniChart` | `src/components/mini-chart.jsx:1` | SVG sparkline per-row, recomputes min/max every render |
| `MoneyFlowCard` | `src/components/money-flow-card.jsx:1` | Accordion card in loops |
| `AnalystGaugeChart` | `src/components/analyst-gauge-chart.jsx:7` | SVG math on every render |

**Fix**: Wrap exported components in `React.memo`. Start with `TickerRow` — it renders 10-50 times per page.

### 1.2 AuthProvider context too heavy (25+ keys)

`src/components/auth-provider.jsx:458-510` — Context value includes `loading`, `watchlistLoaded`, `portfolioLoaded` plus 20 other keys. When `watchlistLoaded` toggles, the ENTIRE app tree re-renders (8+ consumer components).

**Consumers affected:**
- `app-layout-client.jsx:19`
- `watchlist/page.jsx:56-63`
- `explore/page.jsx:532`
- `chart/page.jsx:139-147`
- `portfolio-tracker/page.jsx:234-239`
- `discussion/page.jsx:271`
- `msci/page.jsx:264`
- `idx-momentum/page.jsx:351`

**Fix**: Split into `AuthProvider` (auth state only) and `DataProvider` (watchlist/portfolio/loaded flags). Or use selector pattern.

### 1.3 MiniChart recomputes spread min/max per render

`src/components/mini-chart.jsx:6-7`:
```js
const min = Math.min(...data);
const max = Math.max(...data);
```
O(n) per chart row, runs on every render for every row. No memoization.

**Fix**: `useMemo(() => ({ min: Math.min(...data), max: Math.max(...data) }), [data])`.

### 1.4 MarketBubbles physics on every drag move

`src/components/market-bubbles.jsx:93-202,259` — 180 iterations of O(n^2) collision detection re-runs on every `setBubblePositions` (pointer move). This is the most CPU-intensive code in the app.

**Fix**: Throttle physics recalculation to ~16ms (requestAnimationFrame), or debounce position updates.

### 1.5 Explore page 15+ useState calls

`src/app/explore/page.jsx:533-555` — 15 individual `useState` calls. Related state should be grouped:
```js
const [marketState, setMarketState] = useState({
  tab: 'us', timeframe: '1D', quotes: {}, loading: false
});
```

---

## 2. API ROUTE PERFORMANCE (P0-P1)

### 2.1 Fundamentals: no server-side caching (P0)

`src/app/api/fundamentals/route.js` — Every request hits Yahoo Finance twice (`quote()` + `quoteSummary()`). No DB cache like `/api/quotes` has.

**Fix**: Add `readMarketDataCache`/`writeMarketDataCache` pattern (same as quotes route). TTL: 5 min.

### 2.2 Fundamentals: sequential Yahoo calls (P1)

`src/app/api/fundamentals/route.js:116-175`:
```js
quote = await yahooFinance.quote(symbolKey, ...)        // line 116
summaryModules = await yahooFinance.quoteSummary(...)    // line 142
```
Independent calls. Should be `Promise.all()`. Cuts latency ~50%.

### 2.3 Money-flow: sequential independent queries (P1)

`src/app/api/money-flow/route.js:107-139` — Two independent Supabase queries run sequentially.

**Fix**: `Promise.all([query1, query2])`.

### 2.4 7 API routes create Supabase client per request (P1)

These routes call `createClient(url, key)` on every request instead of using the singleton from `src/lib/supabase-server.js`:

- `src/app/api/msci/route.js:64`
- `src/app/api/rotation/route.js:25`
- `src/app/api/bubbles/route.js:25`
- `src/app/api/discussions/route.js:52`
- `src/app/api/money-flow/route.js:105`
- `src/app/api/momentum/route.js:50`
- `src/app/api/cron/money-flow/route.js:178`

**Fix**: Replace with `getSupabaseServiceRoleClient()`.

### 2.5 Momentum route over-fetches columns (P2)

`src/app/api/momentum/route.js:55-61` — `.select('*')` pulls all columns. Should select only needed fields.

---

## 3. BUNDLE & LOADING (P1)

### 3.1 All pages are `"use client"`

Every page component is client-rendered. Zero SSR streaming. Some could be server components with client islands:

| Page | Could be server? |
|---|---|
| `account/page.jsx` | Yes — just a redirect with `redirect()` |
| `money-flow/page.jsx` | Partially — data fetch could be server |
| `msci/page.jsx` | Partially — data fetch could be server |
| `idx-rotation/page.jsx` | Partially — SVG rendering is presentational |

### 3.2 MarketBubbles not dynamically imported

`src/app/idx-bubbles/page.jsx:4` — 582-line component with physics simulation statically imported. Should use `dynamic()`.

### 3.3 `cmdk` for single use

`package.json:26` — `cmdk` imported only for portfolio search (`portfolio-tracker/page.jsx:14`). Could be replaced with `<Input>` + filtered list.

---

## 4. FILE SIZE (P1)

| Lines | File | Issue |
|---|---|---|
| **2775** | `src/app/chart/page.jsx` | God Component — skeleton, render functions, format callbacks, market logic, fullscreen, dialogs all in one |
| **1452** | `src/app/explore/page.jsx` | Inline data, utilities, multiple fetch callbacks, full page render |
| **1055** | `src/app/portfolio-tracker/page.jsx` | Multiple concerns in one file |
| **883** | `src/lib/money-flow.js` | Business logic — acceptable but large |
| **743** | `src/app/api/screeners/[category]/route.js` | Complex API route |
| **582** | `src/components/market-bubbles.jsx` | Physics + SVG + UI |
| **557** | `src/app/idx-momentum/page.jsx` | Page component |

**chart/page.jsx** needs splitting into: `ChartPage`, `ChartSidebar`, `ChartHeader`, `ChartTabs`, `formatUtils`.

---

## 5. CODE DUPLICATION (P2)

### 5.1 `isWithinMarketHours` duplicated

- `src/app/explore/page.jsx:193`
- `src/components/trending-marquee.jsx:40`

Identical function. Extract to `src/lib/market-hours.js`.

### 5.2 Market-category ordering duplicated

- `src/app/explore/page.jsx:218` (`getCategoryDisplayOrder`)
- `src/components/trending-marquee.jsx:65` (`getTrendingOrder`)

Same logic, different names.

### 5.3 Batch-quote fetch reimplemented

`fetchBatchQuotes` exists in `src/lib/api-client.js:77` but is reimplemented inline in:
- `src/components/trending-marquee.jsx:121`
- `src/app/explore/page.jsx:585, 638`
- `src/hooks/use-portfolio-data.js:63`

### 5.4 Supabase client init boilerplate

7 API routes repeat `const supabaseUrl = process.env...` + `createClient(...)` instead of using `getSupabaseServiceRoleClient()`.

### 5.5 Watchlist hydration copy-pasted

Same pattern in `watchlist/page.jsx:165-211` and `chart/page.jsx:224-259`. Should be a custom hook.

---

## 6. CSS (P2)

### 6.1 Duplicate scrollbar utilities

`src/app/globals.css:203-210` defines `.hide-scrollbar`, lines 343-353 define `.scrollbar-hide` — identical CSS.

### 6.2 Styled JSX in market-bubbles

`src/components/market-bubbles.jsx:543-575` — `<style jsx global>` keyframes. Inconsistent with Tailwind pattern. Move to `globals.css`.

### 6.3 Redundant `.font-semibold` override

`src/app/globals.css:367-369` — Overrides Tailwind's built-in `font-semibold` with the same value. Remove.

---

## 7. LOCALSTORAGE (P2)

### 7.1 `loadPortfolio()` called twice synchronously

`src/app/portfolio-tracker/page.jsx:242-243`:
```js
const [currency, setCurrency] = useState(() => { const d = loadPortfolio(); ... });
const [isPortfolioHidden, setIsPortfolioHidden] = useState(() => { const d = loadPortfolio(); ... });
```
Each call reads up to 5 localStorage keys. 10 sync reads on page init.

**Fix**: Hoist to single call: `const initialPortfolio = loadPortfolio();`

### 7.2 Appearance mode reads localStorage in useState

`src/components/appearance-mode-provider.jsx:14-22` — Synchronous `localStorage.getItem()` blocks hydration. Low impact (1 key) but on critical path.

---

## 8. SERVICE WORKER (P3)

### 8.1 Runtime cache unbounded

`src/public/sw.js:98-108` — `RUNTIME_CACHE` grows indefinitely. No max entries or LRU eviction.

**Fix**: Add cache size limit (e.g., `maxEntries: 100`).

### 8.2 API cache never expires

`src/public/sw.js:87-96` — `networkFirst` caches API responses but never expires them. Stale data accumulates.

**Fix**: Add TTL-based expiry or max-age headers.

### 8.3 Misleading cache name

`src/public/sw.js:3` — `aruna-static` contains HTML pages (not static assets). Rename to `aruna-pages`.

---

## 9. SECURITY (P2)

### 9.1 XOR encoding = obfuscation, not encryption

`src/lib/secure-payload.js:43-50` — XOR with repeating key is trivially reversible. Used in 97 API references. Provides false sense of security. HTTPS already protects data in transit.

**Decision needed**: Keep as obfuscation (accept the limitation) or remove entirely.

### 9.2 `window.open` without noopener

`src/app/chart/page.jsx:1398` — `window.open(link, '_blank')` without `noopener,noreferrer`. Enables reverse tabnapping.

**Fix**: `window.open(link, '_blank', 'noopener,noreferrer')`.

### 9.3 No CSRF on mutation routes

`src/app/api/discussions/route.js` (POST, DELETE) and `src/app/api/delete-account/route.js` — No CSRF token. Relies on SameSite cookies (acceptable but noted).

---

## 10. ERROR HANDLING (P2)

### 10.1 Silent sync failures (6+ instances)

Fire-and-forget `.catch(() => {})` silently drops sync failures:

- `src/app/chart/page.jsx:1160`
- `src/app/watchlist/page.jsx:198, 528`
- `src/app/portfolio-tracker/page.jsx:297`
- `src/hooks/use-portfolio-data.js:132`

User data may not persist with no indication.

### 10.2 Console.warn only — no user feedback (12+ instances)

Catch blocks that only `console.warn`:

- `src/app/watchlist/page.jsx:144, 237`
- `src/app/explore/page.jsx:595, 709, 725`
- `src/components/auth-provider.jsx:155, 195, 224, 330`
- `src/hooks/use-chart-news.js:29`
- `src/hooks/use-chart-fundamentals.js:46`

User sees stale data or empty state with no explanation.

### 10.3 No `loading.jsx` in any route

Zero loading states for route transitions. Users see blank content during navigation.

---

## 11. ACCESSIBILITY (P3)

### 11.1 Missing `aria-label` on icon-only buttons

- `src/app/chart/page.jsx:2531` — ArrowLeft close button
- `src/components/market-bubbles.jsx:428` — Download button
- `src/components/chart-header-bar.jsx:23` — `<div role="button">` without `aria-label`

### 11.2 Missing keyboard handlers on cards

- `src/app/explore/page.jsx` — Multiple card `onClick` without keyboard handlers

---

## 12. DEAD CODE (P3)

### 12.1 Backward-compat re-exports

`src/lib/msci-calculations.js:103` — Re-exports `formatMarketCap`, `formatPrice`, `formatPercent` from utils. Check if anyone imports from msci-calculations.

### 12.2 Unnecessary useMemo

`src/app/explore/page.jsx:959-964` — `topMoversPreview` memo is trivial passthrough of already-memoized `breakoutInsights`.

---

## Suggested Execution Order

### Phase 1: Quick Wins (1-2 hours)
1. Fix fundamentals API sequential calls → `Promise.all` (2.2)
2. Fix money-flow API sequential calls → `Promise.all` (2.3)
3. Replace 7 API routes with singleton Supabase client (2.4)
4. Add `React.memo` to `TickerRow` and `MiniChart` (1.1, 1.3)
5. Fix `loadPortfolio()` double-call (7.1)
6. Fix `window.open` noopener (9.2)

### Phase 2: Core Performance (4-8 hours)
7. Add server-side caching to fundamentals API (2.1)
8. Split AuthProvider context (1.2)
9. Add `React.memo` to remaining list components (1.1)
10. Throttle MarketBubbles physics (1.4)
11. Consolidate explore page state (1.5)
12. Dynamic import MarketBubbles (3.2)

### Phase 3: Architecture (1-2 days)
13. Split chart/page.jsx into smaller components (4)
14. Extract duplicated utilities (5.1-5.5)
15. Move styled JSX to globals.css (6.2)
16. Add loading.jsx to route segments (10.3)

### Phase 4: Polish (ongoing)
17. Add error feedback for sync failures (10.1, 10.2)
18. Add aria-labels to icon buttons (11.1)
19. Clean up dead code (12)
20. Remove cmdk dependency (3.3)

---

## Progress Log

### Phase 1: Quick Wins ✅ (commit 296e9b3)
- [x] Fundamentals API sequential → Promise.all (2.2)
- [x] Money-flow API sequential → Promise.all (2.3)
- [x] 7 API routes → singleton Supabase client (2.4)
- [x] React.memo on TickerRow + MiniChart (1.1, 1.3)
- [x] loadPortfolio() double-call fixed (7.1)
- [x] window.open noopener (9.2)

### Phase 2: Core Performance ✅ (commit 9c686a9)
- [x] Fundamentals API in-memory cache with 5-min TTL (2.1)
- [x] React.memo on MoneyFlowCard, AnalystGaugeChart, TickerAvatar (1.1)
- [x] MarketBubbles drag throttled with requestAnimationFrame (1.4)
- [x] MarketBubbles dynamic import for lazy loading (3.2)
- [x] Split AuthProvider context — done in Phase 5 (1.2)

### Phase 3: Architecture ✅
- [x] Extract isWithinMarketHours to `src/lib/market-hours.js` (5.1)
- [x] Extract batch-quote fetch in trending-marquee to use `fetchBatchQuotes` (5.3)
- [x] Move styled JSX keyframes to globals.css (6.2)
- [x] Remove duplicate scrollbar-hide CSS utilities (6.1)
- [x] Extract format callbacks to `src/lib/chart-formatters.js` (4) — 2677 lines remain
- [x] Add loading.jsx to route segments (10.3) — all 14 routes

### Phase 4: Polish ✅
- [x] Error feedback for sync failures (10.1, 10.2)
- [x] aria-labels on icon buttons (11.1)
- [x] Dead code cleanup (12)
- [x] Remove cmdk dependency (3.3)

### Phase 5: Additional Polish ✅
- [x] Consolidate explore page state — grouped 15 useState into market/pwa/refresh (1.5)
- [x] Split AuthProvider context into AuthContext + DataContext (1.2)
- [x] Remove redundant .font-semibold CSS override (6.3)
- [x] Service worker cache limits + API TTL expiry (8.1, 8.2)

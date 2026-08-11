# State Management

## Philosophy

No global state management library (Redux, Zustand, Jotai, etc.). State is managed through:
- **React Context** for cross-component shared state (auth, theme, appearance mode, trial).
- **localStorage** for persistent user data (watchlist, portfolio, preferences).
- **Component-local state** (`useState`, `useEffect`) for page-specific data.

## State Categories

### 1. Auth State — `AuthProvider` (React Context)

```javascript
const {
  user,                    // User object or null
  session,                 // Supabase session or null
  loading,                 // Initial session check in progress
  supabaseConfigured,      // Supabase env vars present
  // Remote sync state
  remoteWatchlist,         // Array or null
  remoteWatchlistUpdatedAt,// ISO timestamp or null
  watchlistLoaded,         // Boolean
  remotePortfolio,         // Array or null
  remotePortfolioUpdatedAt,// ISO timestamp or null
  portfolioLoaded,         // Boolean
  // Actions
  signInWithGoogle,
  signOut,
  syncWatchlist,
  syncPortfolio,
  refreshRemoteWatchlist,
  refreshRemotePortfolio,
  clearRemoteData,
  deleteAccount,
} = useAuth();
```

### 2. Watchlist & Portfolio — localStorage + Supabase

**Guest mode**: Data stored in `localStorage` keys `aruna_watchlist` and `aruna-portfolio`.

**Authenticated mode**: Data loaded from Supabase `watchlists` and `portfolios` tables on sign-in. Written to both localStorage (cache) and Supabase (remote) on changes.

**Sync strategy**: Local-first. Remote data overwrites local on sign-in. Local changes are pushed to remote via `syncWatchlist()` / `syncPortfolio()`.

**Portfolio canonical schema (`aruna-portfolio`)**:
```json
{
  "entries": [{ "symbol": "AAPL", "name": "Apple Inc.", "amount": 50, "unit": "share", "avgPrice": 175, "type": "digital" }],
  "currency": "IDR | USD | SGD",
  "visibilityHidden": false
}
```
- One-time migration from legacy keys (`portfolio_currency`, `portfolio_visibility_hidden`, `aruna_guest_portfolio`, `aruna_guest_portfolio_seeded`) on first load.
- All persistence goes through `src/lib/portfolio-storage.js`. No component accesses `localStorage` directly for portfolio data.
- `ClearDataButton` removes canonical record and all legacy portfolio keys.

### 3. Theme — `ThemeProvider` (next-themes)

- Persisted to `localStorage` key `aruna-theme`.
- Options: `light`, `dark`, `system`.
- Default: `dark`.

### 4. Appearance Mode — `AppearanceModeProvider` (React Context)

- Persisted to `localStorage` key `aruna-appearance-mode`.
- Options: `pro` (show logos), `lite` (hide logos).

### 5. Trial State — `TrialProvider` (React Context)

- Persisted to `localStorage` key `aruna-trial-state`, storing `{ startedAt, expiresAt }`.
- 60-minute guest trial (`TRIAL_DURATION_MS = 60 * 60 * 1000` in `trial-provider.jsx`).
- Provides `isTrialActive()` check, plus `restartTrial()`/`expireTrial()` for manual control.

### 6. Page-Level Data — Component State

Each page fetches its own data via `useState` + `useEffect`:

```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchEncodedJson('/api/some-endpoint')
    .then(({ data }) => setData(data))
    .catch(err => console.warn(err))
    .finally(() => setLoading(false));
}, []);
```

## Data Fetching Pattern

```
1. Component mounts
2. useEffect triggers fetch
3. Loading state shown (spinner/skeleton)
4. Data received → setState
5. Error → show error UI
6. Cleanup on unmount (AbortController for search)
```

## Caching

- No client-side cache layer (React Query, SWR, etc.).
- No server-side cache configuration.
- Browser HTTP cache used for static assets and API responses (implicitly).
- Service worker caches app shell (network-first for pages, stale-while-revalidate for assets).

## Why Not a State Library?

The application's state needs are simple enough for React Context + localStorage. Adding Redux or Zustand would add complexity without benefit for the current scale. If the app grows significantly (more cross-cutting state, real-time updates, optimistic updates), consider:
- **Zustand** for simpler global state.
- **React Query / TanStack Query** for server state caching and cache invalidation.

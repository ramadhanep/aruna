# State Management

- Auth state: React Context
- Theme: `next-themes`
- Appearance mode: React Context
- Watchlist and portfolio: `localStorage` plus optional Supabase sync
- Page data: component state
- No global state library
- No client cache library

## Caching

- Server caches quotes and price series in Supabase tables
- Browser cache handles static assets
- Service worker caches the app shell

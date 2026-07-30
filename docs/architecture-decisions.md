# Architecture Decisions

## ADR-001: XOR Response Obfuscation

**Status**: Accepted

**Decision**: All API responses (except discussions and cron) are XOR-encoded with a shared key before sending to the client.

**Reason**: Prevent casual inspection of API response data in browser devtools. The app serves financial data that could be scraped or reverse-engineered.

**Alternatives considered**:
- JWT encryption — more secure but adds complexity.
- No encryption — simpler but exposes raw data.
- HTTPS-only — already in place, but doesn't prevent client-side inspection.

**Tradeoffs**:
- XOR is **not cryptography** — it provides obfuscation only, not security.
- Adds processing overhead on both server and client.
- Key management — shared secret must be configured in environment.
- Breaks standard API tooling (Postman, curl) unless aware of the encoding.

**Implementation**: `lib/secure-payload.js` — `encodePayload()` / `decodePayload()` / `decodeApiResponse()`.

## ADR-002: Local-First Architecture for User Data

**Status**: Accepted

**Decision**: Watchlist and portfolio data default to `localStorage`. Supabase sync is optional and on-demand.

**Reason**: Users can use the app without signing in. Data persists across sessions without requiring authentication. Reduces backend load.

**Alternatives considered**:
- Cloud-only — requires auth for any use, increases friction.
- Cloud-primary with offline cache — more complex sync logic.

**Tradeoffs**:
- Data fragmentation — user may have different data on different devices until they sign in.
- Sync conflicts — local changes and remote changes may diverge. Current strategy: remote overwrites on sign-in, local changes pushed on explicit sync.
- Data loss risk if localStorage is cleared.

## ADR-003: No TypeScript

**Status**: Accepted

**Decision**: The project uses plain JavaScript (JSX) with no TypeScript.

**Reason**: Faster development iteration, lower barrier for contributions, sufficient for current project size.

**Alternatives considered**:
- Full TypeScript — adds type safety but increases build complexity and development overhead.
- JSDoc annotations — lighter than TypeScript but not enforced.

**Tradeoffs**:
- No compile-time type checking.
- IDE support relies on JSDoc and inference.
- Refactoring is riskier without type safety.
- Data shapes must be inferred from usage or documentation.

**Future consideration**: If the codebase grows significantly, consider migrating to TypeScript gradually.

## ADR-004: No State Management Library

**Status**: Accepted

**Decision**: React Context + localStorage instead of Redux, Zustand, or similar.

**Reason**: Application state needs are simple — auth context, theme, and user data. A state management library would add unnecessary complexity.

**Alternatives considered**:
- Zustand — simpler than Redux, but still overhead for current needs.
- Redux Toolkit — too heavy for this application.
- Jotai/Recoil — not evaluated.

**Tradeoffs**:
- Context re-renders all consumers on any change.
- No built-in devtools for state debugging.
- No middleware for side effects.

## ADR-005: API Routes as External API Proxy

**Status**: Accepted

**Decision**: All external API calls (Yahoo Finance, Stockbit, etc.) are made through Next.js API routes, never from the browser directly.

**Reason**: Protect API keys and bearer tokens. Transform and normalize external data. Apply consistent response format (XOR encoding). Enable server-side caching in the future.

**Alternatives considered**:
- Browser direct calls — exposes API keys, no data transformation layer.
- Dedicated backend service — more complex infrastructure.

**Tradeoffs**:
- Adds latency (request goes through Next.js server → external API → response).
- Serverless function timeout limits (Vercel 10s for Hobby, 60s for Pro).
- Uses serverless function runtime (cost, cold starts).

## ADR-006: Supabase as Auth Provider

**Status**: Accepted

**Decision**: Use Supabase Auth with Google OAuth for authentication.

**Reason**: Supabase is already the database provider — adding auth from the same platform reduces integration complexity. Supports OAuth, RLS integration, and session management.

**Alternatives considered**:
- NextAuth.js / Auth.js — more flexible, but adds another dependency.
- Clerk — paid service, overkill for current needs.
- Firebase Auth — different ecosystem, adds complexity.

**Tradeoffs**:
- Tied to Supabase ecosystem.
- Google-only OAuth — no email/password, Apple, or other providers.
- Client-side auth only — no server-side session cookies.

## ADR-007: Monorepo with Flutter (Discontinued, Now Removed)

**Status**: Superseded

**Decision**: An `aruna/` directory once contained a Flutter mobile app that was the original client. Development shifted entirely to the Next.js PWA, and the Flutter directory has since been removed from the repository — it no longer exists at the repo root.

**Reason**: PWA approach provides cross-platform coverage (iOS, Android, Web) from a single codebase. Faster iteration. No app store submission.

**Tradeoffs**:
- None remaining — the cleanup this ADR anticipated has already happened.

## ADR-008: Hardcoded USD/IDR Exchange Rate

**Status**: Known Debt

**Decision**: MSCI calculations use a hardcoded exchange rate of 15,800 IDR/USD.

**Reason**: The MSCI tracker was built as a minimum viable feature. A live exchange rate API was not integrated.

**Alternatives considered**:
- FreeForexAPI / ExchangeRate-API — adds another dependency.
- Yahoo Finance currency pair — possible but adds complexity.

**Tradeoffs**:
- Rate will be inaccurate as the real exchange rate fluctuates.
- Hardcoded value marked with `TODO` in `lib/msci-calculations.js`.

## ADR-009: CORS Enforcement Disabled

**Status**: Known Debt

**Decision**: Strict CORS origin blocking is commented out in `middleware.js`.

**Reason**: During development, strict CORS caused issues with various tooling and development workflows. The CORS headers are still applied, but unauthorized origins are not blocked.

**Tradeoffs**:
- CORS configuration is decorative, not protective.
- Any origin can access API routes (though data is XOR-obfuscated).

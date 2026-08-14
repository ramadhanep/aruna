# Aruna — AI Session Context

**Version:** 1.7.56
**Project:** Mobile-first stock market analysis platform for Indonesian retail investors (IDX, US equities, crypto). Next.js 16 App Router, React 19, Supabase, Tailwind v4.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm start        # Run production build
npm run lint     # ESLint (eslint.config.mjs) — run before committing
npm run test     # Vitest unit tests (tests/unit/*.test.js)
npm run test:e2e # Playwright E2E smoke tests (needs `npx playwright install chromium`)
```

Trigger cron jobs manually in dev (not auto-scheduled locally):
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/idx
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/money-flow
```

## Architecture

- **Dependency flow:** `Pages (src/app/*) → Components (src/components/*) → Lib (src/lib/*)`. API routes (`src/app/api/*/route.js`) import lib directly. Lib has no dependencies on components/pages. Components never import API route modules — they call `fetchEncodedJson()`.
- **API as proxy:** all external calls (Yahoo Finance, Stockbit, Supabase) go through Next.js API routes, never from the browser directly.
- **Response obfuscation:** every API response except `/api/cron/*` is XOR-encoded via `encodePayload()` (`src/lib/secure-payload.js`) inside a `{"payload": "..."}` envelope, keyed by `SECURE_PAYLOAD_KEY`. Client decodes with `fetchEncodedJson()` from `@/lib/api-client`. This is obfuscation, not real security. `/api/discussions` is included — GET/POST/DELETE all encode their responses.
- **Local-first data:** watchlist/portfolio default to `localStorage`; sync to Supabase (`watchlists`, `portfolios` tables) is optional, merged in `auth-provider.jsx` on sign-in.
- **No server-side route protection** in `src/proxy.js` — it only applies CORS to `/api/*` (currently permissive/decorative) and rate-limits `/api/screeners` per-IP. Access control is API-level bearer checks (cron `CRON_SECRET`, delete-account user token) + RLS + client-side feature gating.
- **Auth:** Supabase Google OAuth. Client-side reads: `getSupabaseBrowserClient()`. Two server-side auth patterns coexist: (1) Bearer-token — `getSupabaseServiceRoleClient()` + `getUserFromRequest()` for `delete-account` and `CRON_SECRET` checks for cron routes; (2) cookie-session — `/api/discussions` POST/DELETE use `createServerClient()` from `@supabase/ssr` with `cookies()` (`next/headers`) to read the real Supabase session cookie. Don't assume "no server session cookies" project-wide — that only holds for the Bearer-token routes.
- **Cron-dependent features:** money flow scoring and screeners depend on scheduled `/api/cron/*` routes (Vercel cron, see `vercel.json`) that scrape Stockbit and write to Supabase; each run truncates the relevant table first.

Full details: [Architecture](docs/architecture.md), [Folder Structure](docs/folder-structure.md), [Database](docs/database.md), [Known Issues](docs/known-issues.md), or the top-level [README.md](README.md).

## Quick Links

| Document | Purpose |
|---|---|
| [Project Overview](docs/project-overview.md) | Purpose, features, business goals |
| [Architecture](docs/architecture.md) | High-level architecture, layers, dependency flow |
| [Tech Stack](docs/tech-stack.md) | Frameworks, languages, libraries, infrastructure |
| [Folder Structure](docs/folder-structure.md) | Every directory explained |
| [Coding Standards](docs/coding-standards.md) | Naming, patterns, error handling, TypeScript |
| [Conventions](docs/conventions.md) | Component, hook, utility conventions |
| [Application Flow](docs/application-flow.md) | Startup, request lifecycle, data flow |
| [Authentication](docs/authentication.md) | Auth flow, session, token lifecycle |
| [Authorization](docs/authorization.md) | Roles, permissions, access control |
| [API](docs/api.md) | API architecture, endpoints, error handling |
| [Database](docs/database.md) | Schema, relationships, repository pattern |
| [Environment](docs/environment.md) | Variables, secrets, configuration |
| [Deployment](docs/deployment.md) | Build, deploy, CI/CD, hosting |
| [Testing](docs/testing.md) | Testing strategy, framework, coverage |
| [UI Architecture](docs/ui-architecture.md) | Layout, pages, components, responsive |
| [State Management](docs/state-management.md) | Global state, local state, caching |
| [Dependencies](docs/dependencies.md) | Key dependencies and why they exist |
| [Integrations](docs/integrations.md) | Third-party APIs, services |
| [Architecture Decisions](docs/architecture-decisions.md) | ADR-style decision records |
| [Known Issues](docs/known-issues.md) | Bugs, debt, limitations, workarounds |
| [Roadmap](docs/roadmap.md) | Completed, in-progress, planned |
| [Glossary](docs/glossary.md) | Project-specific terminology |
| [AI Session Handoff](docs/ai-session-handoff.md) | Session continuity template |

## Before Modifying Code

1. Read `docs/architecture.md` — understand layers and dependency flow.
2. Read `docs/coding-standards.md` — follow project patterns.
3. Read `docs/conventions.md` — respect naming and structure.
4. Read `docs/folder-structure.md` — know where code belongs.
5. Read `docs/ai-session-handoff.md` — continue previous work.

## Development Rules

- Preserve existing architecture patterns. Do not introduce new paradigms without ADR.
- Maintain naming consistency across the codebase.
- No duplicate business logic. Reuse from `src/lib/` utilities.
- All API responses (except `/api/cron/*`) must be XOR-obfuscated via `encodePayload()`.
- Client components use `"use client"` directive; server components are default.
- Theme uses `next-themes` with `dark` default. CSS variables in `globals.css`.
- Run `npm run lint` before committing. ESLint config at `eslint.config.mjs`.
- API routes use `encodePayload()`; client-side uses `fetchEncodedJson()` from `@/lib/api-client`.

## When Implementation Changes

- Update relevant docs in `docs/`.
- If adding new env vars, update `docs/environment.md`.
- If adding new API route, update `docs/api.md`.
- If changing DB schema, update `docs/database.md` and `supabase/setup.sql`.
- If adding new dependency, update `docs/dependencies.md`.
- Update `docs/ai-session-handoff.md` after completing significant work.

## Never

- Break the layer architecture (pages → components → lib).
- Introduce inconsistent patterns (e.g., mixing state libraries).
- Duplicate business logic already in `src/lib/`.
- Hardcode values that should be env vars.
- Modify `public/sw.js` without updating PWA cache strategy docs.
- Skip documentation updates for architectural changes.

## Always

- Use `cn()` from `@/lib/utils` for className merging.
- Use `@/` path alias for imports.
- Use `fetchEncodedJson()` for API calls (decodes XOR payload).
- Wrap client components that use `useSearchParams` in `<Suspense>`.
- Add RLS policies for new Supabase tables.
- Keep `supabase/setup.sql` in sync with actual schema.

# Documentation Drift Report

> **Status (updated Phase 7):** Archived. All listed drift was corrected across
> Phases 0–7; the remaining open item (cron scheduling) was resolved by the
> Phase 7 decision to keep scheduling disabled (`docs/deployment.md`). Keep
> this file as historical record; new doc-state findings belong in
> `docs/known-issues.md`.

Audited: 22 files in `docs/` + root `CLAUDE.md`, verified against actual source (not against each other).

## CLAUDE.md — WRONG

Claims "every API response except `/api/discussions` and `/api/cron/*` is XOR-encoded" — but `src/app/api/discussions/route.js` calls `encodePayload()` in `GET` (line 113), `POST` (line 228), and `DELETE` (line 303). This is a load-bearing error: the "Always" rule ("All API responses ... must be XOR-obfuscated via `encodePayload()`") and other docs (api.md, conventions.md, authorization.md) all repeat the false exception. Also: "Auth: ... client-side only, no server session cookies" is contradicted by `discussions/route.js` POST/DELETE, which use `createServerClient` from `@supabase/ssr` with `cookies()` (next/headers) for session auth — a real server-side cookie session, not Bearer-token-only.

## docs/ai-session-handoff.md — STALE

Pure unfilled template (`*[Date]*`, `*[Brief summary]*` placeholders throughout). `git log --oneline -- docs/ai-session-handoff.md` shows it was only ever touched once, in the initial docs commit (953fb0d) — never updated despite subsequent feature work (ticker-row refactor, framer-motion removal, easter egg additions). Provides no actual session continuity.

## docs/api.md — WRONG

States "`/api/discussions`... (Plain JSON, not XOR-encoded)" (lines 14, 144, 152). Contradicted by `src/app/api/discussions/route.js:112-114` (`return NextResponse.json({ payload: encodePayload(payload) })` in GET), and identical `encodePayload()` calls in POST (line 227-229) and DELETE (line 302-304). All other endpoint shapes checked (`/api/finance`, `/api/quotes`, `/api/delete-account`) matched actual route code.

## docs/application-flow.md — ACCURATE

Provider order (`ThemeProvider → AuthProvider → TrialProvider → AppearanceModeProvider → PWARegister → PWAInstallDialog → TrialGuard → AppLayoutClient`) matches `src/app/layout.jsx:50-71` exactly. `src/app/page.jsx` redirects to `/explore` as claimed. `src/app/account/page.jsx` redirects to `?redirect=` param or `/portfolio-tracker`, matching the described OAuth callback flow.

## docs/architecture-decisions.md — STALE

ADR-001 (XOR), ADR-004 (no state library), ADR-008 (hardcoded USD/IDR rate — confirmed verbatim in `src/lib/msci-calculations.js:13`, `USD_TO_IDR = 15_800` with `TODO` comment), and ADR-009 (CORS disabled — confirmed in `src/middleware.js:94-109`, blocking logic commented out) all hold. ADR-007 ("Monorepo with Flutter... `aruna/` directory contains a Flutter mobile app") is stale: `find` confirms no `aruna/` directory exists at repo root — it has already been removed, not merely "present but not maintained."

## docs/authentication.md — WRONG

"No server-side session cookies — all API auth is via Bearer token" is false: `src/app/api/discussions/route.js` POST and DELETE use `createServerClient` (`@supabase/ssr`) wired to `cookies()` from `next/headers`, i.e., genuine server-side cookie-based session auth, coexisting with the Bearer-token pattern used elsewhere (delete-account, cron). Everything else (storage key `aruna_auth` confirmed in `src/lib/supabase-browser.js:29`, `getUserFromRequest` in `supabase-server.js`, OAuth `access_type=offline`/`prompt=consent` confirmed in `auth-provider.jsx:223-226`) checks out.

## docs/authorization.md — WRONG

Table entry "`/api/discussions` (POST) | User session | Bearer token → Supabase Auth" is incorrect — POST/DELETE actually authenticate via `@supabase/ssr` cookie session (`supabase.auth.getUser()` off the request's cookies), not a Bearer token. `PUBLIC_ROUTES` set and CORS-decorative claims are accurate (verified against `src/components/app-layout-client.jsx:15` and `src/middleware.js`).

## docs/coding-standards.md — WRONG

"No semicolons (standard in this codebase)" is false — semicolons are used pervasively: `src/lib/secure-payload.js` (39 occurrences), `src/middleware.js` (42), `src/lib/utils.js` (33), `src/components/mobile-bottom-nav.jsx` (30). Quote style is also mixed (double quotes for directives like `"use client"`, single quotes in many imports), not the strict single-quote convention claimed. Other claims (kebab-case files, `function` keyword for components, `fetchEncodedJson`/`promisePool` patterns) check out against sampled files.

## docs/conventions.md — WRONG

Two errors: (1) "`oklch()` color space" for CSS — `src/app/globals.css:60-80` uses plain hex values (`--background: #f7f7f3`, `--foreground: #111111`, etc.), no `oklch()` anywhere in `:root`/`.dark`. (2) Local Storage Keys table lists `aruna_trial_end` for trial expiry — actual key in `src/components/trial-provider.jsx:6` is `TRIAL_STORAGE_KEY = "aruna-trial-state"`; `aruna_trial_end` does not exist in the codebase. Also repeats the false discussions-XOR-exception. Other localStorage keys (`aruna_auth`, `aruna-theme`, `aruna-watchlist`, `aruna-portfolio`) confirmed correct.

## docs/dependencies.md — WRONG

Lists `framer-motion ^12.38.0` as a production dependency — absent from `package.json`; removed per commit `9682f75 refactor: consolidate ticker row/dialog components, drop framer-motion`. Also claims `@supabase/ssr` is "installed but not actively used... Reserved" — false: it is actively imported and used (`createServerClient`) in `src/app/api/discussions/route.js` for POST/DELETE auth. All other listed packages/versions matched `package.json` exactly.

## docs/deployment.md — WRONG

Quotes a `vercel.json` with a `crons` array scheduling `/api/cron/idx`, `/api/cron/us`, `/api/cron/crypto` — the actual `vercel.json` is a bare `{}` (confirmed via `Read` and `git show HEAD:vercel.json`); git history shows cron config existed in earlier commits and was subsequently stripped down to nothing, so currently no cron job is scheduled at all (not just money-flow, as docs/roadmap.md separately implies). Also claims manifest is "generated dynamically at `/api/manifest.json`" — actual route lives at `src/app/manifest.json/route.js`, served at `/manifest.json` (confirmed via `layout.jsx:22`: `manifest: '/manifest.json'`), not under `/api/`.

## docs/environment.md — STALE

Core required vars and the `next.config.mjs` env-block description are accurate (`NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_APP_URL`, `SECURE_PAYLOAD_KEY` — all match `next.config.mjs:7-12` exactly). But the doc says "See `.env.template` ... for a complete list" — `.env.template` only has 6 vars (`APP_URL`, `CRON_SECRET`, `SECURE_PAYLOAD_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) while code also reads `STOCKBIT_AUTHORIZATION_BEARER`, `STOCKBIT_SCREENER_TEMPLATE_ID`, `API_ALLOWED_ORIGINS`, `VERCEL_URL` — none of which are in the template.

## docs/folder-structure.md — STALE

Component tree is missing `src/components/ticker-row.jsx` and `src/components/ticker-row-skeleton.jsx` (both exist, added by commit `9682f75`). Rest of the tree (API routes, lib files, manifest.json route location) matches the actual directory layout.

## docs/glossary.md — WRONG

Entry "**Yield Sign (🪣)** | Visual indicator in the codebase for 'bucket'" is fabricated — `grep -r "🪣"` and `grep -ri "bucket"` across `src/` return zero matches. "**Butter-Smooth**" entry is accurate (`src/components/mobile-bottom-nav.jsx:71`: `// Use passive listener for butter-smooth scrolling...`). Domain terms (IDX, MSCI, RRG, EMA-31, Stockbit, Ajaib, Bibit, Pluang) all check out against usage.

## docs/integrations.md — ACCURATE

Yahoo Finance, Supabase, Stockbit, Pluang CDN, Ajaib, Bibit descriptions all match actual code (`src/app/api/quotes/route.js` `ensureUsLogo()` Pluang flow, `CONCURRENCY_LIMIT = 10` matching the stated rate limit, `ajaib_stocks`/`bibit_stocks` tables in `supabase/setup.sql`).

## docs/known-issues.md — STALE

Most entries verified accurate (XOR non-cryptography, CORS partial via `middleware.js`, hardcoded `USD_TO_IDR`, money-flow cron truncation via `.delete().neq("id", 0)` in `src/app/api/cron/money-flow/route.js:162-163`, hardcoded `DEFAULT_SCREENER_TEMPLATE_ID = "5461641"`, account-page redirect stub, no testing, no rate limiting). But "Flutter App Archive... The `aruna/` directory contains a discontinued Flutter mobile app... (~600MB)" is stale — that directory no longer exists in the repo.

## docs/project-overview.md — ACCURATE

Core features list matches actual routes under `src/app/*` (explore, chart, watchlist, portfolio-tracker, money-flow, msci, idx-bubbles, idx-momentum, idx-rotation, discussion). Implementation-status table is largely reasonable, though "Pricing & trial gating | In development" undersells how built-out `trial-provider.jsx` (192 lines, fully wired into `AppLayoutClient` blocking logic) and `pricing/page.jsx` (169 lines) already are.

## docs/roadmap.md — STALE

Lists "🔄 Trial-based feature gating" and "🔄 Pricing and subscription page" as In Progress, but both are functionally implemented and actively gating routes (`src/components/trial-provider.jsx`, `src/components/trial-guard.jsx`, wired into `app-layout-client.jsx`). Lists "🔮 Clean up Flutter app build artifacts from repository" as a future item — already done (directory doesn't exist). "📋 Money flow cron schedule in `vercel.json`" as the only cron gap — actually understates the real state: `vercel.json` is currently empty, so idx/us/crypto crons are unscheduled too, not just money-flow.

## docs/state-management.md — WRONG

"Trial State — `TrialProvider`... Persisted to `localStorage` key `aruna_trial_end`" is incorrect; the real key (`src/components/trial-provider.jsx:6`) is `"aruna-trial-state"`. `AuthProvider` context shape (all listed fields/actions) matches `src/components/auth-provider.jsx` exactly. Watchlist/portfolio local-first + Supabase sync description is accurate.

## docs/tech-stack.md — WRONG

Lists `framer-motion ^12.38.0` under Charts & Data Visualization — not in `package.json`, removed per commit `9682f75`. Also lists manifest at "`/api/manifest.json` (dynamic Route Handler)" — actual path is `/manifest.json` (`src/app/manifest.json/route.js`, referenced as `/manifest.json` in `layout.jsx`). All other version numbers (next ^16.0.8, react 19.2.0, tailwindcss ^4, lucide-react ^0.548.0, recharts ^2.15.4, lightweight-charts ^5.0.9, etc.) matched `package.json` exactly.

## docs/testing.md — ACCURATE

Confirmed no test runner/files/CI. `package.json` scripts are exactly `dev`, `build`, `start`, `lint` — no test script. Consistent with CLAUDE.md's "No test suite exists."

## docs/ui-architecture.md — WRONG

"Color space: `oklch()`" is false — `src/app/globals.css:58-80` (`:root` block) uses plain hex values throughout (`--background: #f7f7f3`, `--card: #ffffff`, etc.), not `oklch()`. Layout tree, breakpoints (1024px threshold confirmed in `src/hooks/use-mobile.js:3`), navigation, and appearance-mode descriptions are all accurate.

## docs/architecture.md — ACCURATE

Dependency flow, module boundaries, and layer descriptions match actual imports across `src/app`, `src/components`, `src/lib`. (Confirmed in prior spot-check; re-verified against `middleware.js`, `layout.jsx`, `auth-provider.jsx` in this pass.)

## docs/database.md — ACCURATE

All 13 tables and their RLS policies match `create table if not exists` / `create policy` statements in `supabase/setup.sql` exactly, including the later migration that changes `money_flow_reports`'s primary key to the composite `(symbol, report_date, timeframe)` (setup.sql lines 383-393), which the docs correctly reflect.

---

## Priority Fix List (by blast radius)

1. **CLAUDE.md** — false `/api/discussions` XOR exception is load-bearing (other rules and docs cite it) and false "no server session cookies" claim; agents read this first for every task.
2. **docs/api.md** — repeats the same discussions XOR falsehood as the primary API reference.
3. **docs/conventions.md** — repeats discussions XOR falsehood, plus wrong `oklch()` CSS claim and wrong `aruna_trial_end` localStorage key; agents consult this for every new component/API route.
4. **docs/authorization.md** / **docs/authentication.md** — both misdescribe how `/api/discussions` actually authenticates (cookie-session via `@supabase/ssr`, not Bearer token / no-cookies); security-relevant.
5. **docs/dependencies.md** — phantom `framer-motion` dependency and incorrectly-marked-unused `@supabase/ssr` could cause an agent to either reintroduce a removed package or overlook a real active usage when refactoring auth.
6. **docs/tech-stack.md** — same phantom `framer-motion` entry, plus wrong manifest path.
7. **docs/deployment.md** — cron schedule described no longer exists in `vercel.json` (now `{}`); anyone relying on this doc will believe crons are running when they are not.
8. **docs/coding-standards.md** — false "no semicolons" rule could cause an agent to strip semicolons project-wide against the actual style.
9. **docs/ui-architecture.md** — wrong color space (`oklch()` vs hex) could send an agent editing `globals.css` down the wrong path.
10. **docs/state-management.md** — wrong trial localStorage key name.
11. **docs/folder-structure.md** — missing two real component files (low risk, easy fix).
12. **docs/architecture-decisions.md** / **docs/known-issues.md** — stale Flutter `aruna/` directory references (directory no longer exists).
13. **docs/roadmap.md** — stale "in progress"/"planned" items that are already built or already done.
14. **docs/ai-session-handoff.md** — never filled out; low direct risk but defeats its own purpose.
15. **docs/glossary.md** — one fabricated term ("Yield Sign 🪣"); cosmetic.
16. **docs/environment.md** — `.env.template` undersells itself as "complete" when it's missing 4 vars actually read by code; low risk since the vars themselves are documented correctly in the table.

**Accurate, no action needed**: docs/architecture.md, docs/database.md, docs/testing.md, docs/integrations.md, docs/application-flow.md, docs/project-overview.md.

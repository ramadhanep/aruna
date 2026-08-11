# Documentation Drift Report

Audited: all 23 files listed in `CLAUDE.md`'s Quick Links table under `docs/`
(the task brief cited "22" — the actual current count, matching CLAUDE.md's
own table, is 23; `testing.md` is the file most likely to be undercounted at
a glance), plus root `CLAUDE.md`. Every claim below was checked against the
actual source file it names, not against other docs. (Other files that
happen to live in `docs/` — `DOCS_DRIFT_REPORT.md` itself,
`MAINTENANCE_PLAN.md`, `PHASE_EXECUTION_PLAN.md`, `TECH_DEBT.md`,
`UI_AUDIT.md` — are meta/process docs, not in the Quick Links set, and are
out of scope for this audit.)

Headline finding: a single false claim — "`/api/discussions` GET/POST/DELETE
all encode their responses" — was introduced during Phase 7/8 doc reconciliation
and then copy-pasted into six places (`CLAUDE.md`, `api.md`, `architecture.md`,
`conventions.md`, `known-issues.md`, `ai-session-handoff.md`). It is false by
one branch: `src/app/api/discussions/route.js:246-249` (the DELETE handler's
"Supabase configuration missing" branch) still returns raw `NextResponse.json({ error: ... })`,
not `encodePayload()`-wrapped. Every other branch in GET/POST/DELETE (lines
113, 228, 273, 283, 297, 303) does encode correctly, so this is a narrow but
real, repeated inaccuracy.

---

## CLAUDE.md — WRONG

"`/api/discussions` is included — GET/POST/DELETE all encode their responses"
is false for one branch: `src/app/api/discussions/route.js:246-249` (DELETE,
config-missing case) returns plain `{ error: 'Supabase configuration missing' }`,
not `encodePayload()`-wrapped. Everything else in CLAUDE.md checks out:
dependency-flow claims match `docs/architecture.md`, the two-auth-pattern
description (Bearer vs cookie-session for discussions POST/DELETE) is
accurate per `src/app/api/discussions/route.js:138-163,252-276`, and
`src/proxy.js` correctly has no route-protection logic beyond CORS + the
screener rate limit.

## docs/project-overview.md — ACCURATE

Feature list and "Implementation Status" table match what's actually shipped
(`src/app/*` route directories exist for every listed feature). "Mobile app
(Flutter) | Discontinued / archive" is slightly imprecise — the `aruna/`
Flutter directory no longer exists in the repo at all (confirmed via `find`
at repo root), so "archive" overstates what remains; nothing to archive.

## docs/architecture.md — WRONG

Same false claim as CLAUDE.md at line 96 ("`/api/discussions` is included —
its GET/POST/DELETE all encode their responses"), contradicted by
`src/app/api/discussions/route.js:246-249`. Everything else — the layer
diagram, dependency-flow arrows (Pages → Components → Lib; API routes → Lib
directly), and the module-boundary table — matches the real import graph;
spot-checked `src/lib/*` files import no components/pages, and
`src/components/*` files call `fetchEncodedJson()` rather than importing
route handlers.

## docs/tech-stack.md — STALE

`yahoo-finance2` is listed as `^3.14.3` (lines 17, and implicitly via the
table) but `package.json` pins `^4.0.0` — a major-version drift. The
manifest/`framer-motion` issues from the prior scan are already fixed: no
`framer-motion` mention anywhere in this file, and the manifest is correctly
documented as `/manifest.json` (route at `src/app/manifest.json/route.js`,
"not under `/api/`") — line 79.

## docs/folder-structure.md — STALE

Component tree is missing two real files from `src/components/`:
`mini-chart.jsx` (44 lines, actively imported by `explore/page.jsx`,
`portfolio-tracker/page.jsx`, `watchlist/page.jsx`, `ticker-row.jsx`, and
`api/quotes/route.js`) and `toast.jsx` (76 lines, mounted in `layout.jsx`,
imported by `explore` and `portfolio-tracker` and `discussion` pages — also
referenced by `known-issues.md`'s own Phase 7 section as a real Phase-7
deliverable). Both were left out of the tree even though they're documented
elsewhere in the same docs set. Everything else in the tree (API route list,
hooks list, lib list) matches `ls`/`find` output exactly.

## docs/coding-standards.md — WRONG

"No global error boundary is configured" (Error Handling section) is false:
`src/app/error.jsx` (933B) and `src/app/global-error.jsx` (927B) both exist
and are the exact files `known-issues.md`'s own "Resolved in Phase 7" section
credits with adding error boundaries — this doc simply never got the
corresponding update. Naming/style/effect-pattern claims elsewhere in the
file were spot-checked and hold (semicolons pervasive, mixed quote style,
`promisePool` confirmed at `src/app/api/quotes/route.js:98`).

## docs/conventions.md — WRONG

Two real errors: (1) Local Storage Keys table lists `aruna-watchlist` (line
71) for guest watchlist — the actual key, per
`src/lib/default-watchlist.js:20` (`WATCHLIST_STORAGE_KEY = "aruna_watchlist"`)
and `src/components/clear-data-button.jsx:20`, uses an underscore:
`aruna_watchlist`, not a hyphen. (2) Line 48 repeats the false
"`/api/discussions`... GET/POST/DELETE all use `encodePayload()`" claim,
contradicted by the DELETE config-missing branch. Every other localStorage
key in the same table (`aruna_auth`, `aruna-theme`, `aruna-portfolio`,
`aruna_header_symbol_history`, `aruna-trial-state`, `aruna_appearance_mode`,
`aruna_install_prompt_shown`, `aruna_last_election_symbol`, `sidebar_state`)
was individually grepped and confirmed correct. CSS-hex claim (not `oklch()`)
is already correct/up to date.

## docs/application-flow.md — ACCURATE

Provider mount order, startup sequence, and request-lifecycle diagram all
match `src/app/layout.jsx` and `src/proxy.js`. The one imprecision: the
"Request Lifecycle (API)" diagram shows `encodePayload()` as a universal
final step for every route, which glosses over the `/api/health`,
`/api/cron/*`, and the one raw-JSON `/api/discussions` DELETE branch — minor
simplification, not a contradiction of a specific named claim, so this stays
ACCURATE rather than WRONG.

## docs/authentication.md — ACCURATE

Storage key `aruna_auth` confirmed at `src/lib/supabase-browser.js:29`.
Two-pattern server auth description (Bearer for cron/delete-account,
cookie-session via `@supabase/ssr` `createServerClient()` for discussions
POST/DELETE) matches `src/app/api/discussions/route.js:138-163,252-276`
exactly. `access_type: "offline"` / `prompt: "consent"` confirmed at
`src/components/auth-provider.jsx:248-249`. This file was clearly already
corrected relative to older drift (no longer claims "no server-side session
cookies").

## docs/authorization.md — ACCURATE

Route/auth-mechanism table correctly distinguishes Bearer-token
(`cron`, `delete-account`) from cookie-session (`discussions` POST/DELETE),
matching the real code. RLS table matches `supabase/setup.sql` policies.
CORS section correctly calls current enforcement "decorative" — confirmed via
`src/proxy.js`, which applies CORS headers unconditionally (line 146-147) and
has no origin-blocking `Response`/403 path.

## docs/api.md — WRONG

"Response Encoding" section (lines 12-16) claims "`/api/discussions`... success
and error responses both use the `{ payload: ... }` envelope" — contradicted
by the DELETE config-missing branch (route.js:246-249). Interestingly, the
"HTTP Client" section further down (lines 232-234) already documents the
exception generically ("if the body is a non-encoded `{ error: ... }`
(rate-limit 429s, misconfigured routes)") — that's exactly the DELETE branch
in question, so the doc is internally inconsistent: one section states
discussions has no exception, another section implicitly acknowledges one.
Route list (16 endpoints) matches `find src/app/api -name route.js` exactly.

## docs/database.md — WRONG

"Migration Strategy" section: "Tables are dropped and recreated if they exist
(`DROP TABLE IF EXISTS`)" is false — `supabase/setup.sql` uses
`create table if not exists` for all 13 tables (grepped, 13/13 matches, zero
`DROP TABLE` statements anywhere in the file). This is the opposite of what's
documented: existing tables/data are preserved, not dropped. Table inventory
(13 tables), RLS ownership table, and storage bucket names/paths
(`us/<symbol>.svg`, `idx/<symbol>.png`) all match `supabase/setup.sql` and
`src/lib/supabase-storage.js` exactly.

## docs/environment.md — ACCURATE

Required/optional variable tables match `.env.template` (12 vars total) and
the actual `process.env.*` reads found via full-repo grep — no undocumented
env var found, no documented var that's unused. `next.config.mjs` env-block
description matches lines 7-12 of that file exactly.

## docs/deployment.md — ACCURATE

`vercel.json` confirmed as literal `{}`. CI workflow content
(`.github/workflows/ci.yml`) matches the documented lint+build steps and
placeholder env vars exactly. Manifest route path (`/manifest.json`) and
health-endpoint description both match actual route files.

## docs/testing.md — ACCURATE (one loose claim)

"No test runner, no test files, no CI for tests" all hold — confirmed no
`test`/`tests` directory exists and `package.json` has no test script. One
loose sentence: "The `test/` directory referenced in `package.json` does not
exist" — `package.json` doesn't actually reference a `test/` directory
anywhere (no `"test"` string in the file at all), so the premise of that
specific sentence is invented; the conclusion (no test infra) is still
correct, just not for the reason stated.

## docs/ui-architecture.md — ACCURATE

Color-space claim already corrected: "plain hex values ... not `oklch()`"
(line 65) matches `src/app/globals.css:66-95` exactly (`--background:
#f7f7f3`, etc., no `oklch()` in `:root`/`.dark`). `src/lib/motion.js`
confirmed to exist (644 lines) with the described `DURATION`/`EASE`/`MOTION`
exports referenced in "Motion" section.

## docs/state-management.md — WRONG

"Guest mode: Data stored in `localStorage` keys `aruna-watchlist` and
`aruna-portfolio`" (line 41) — `aruna-watchlist` is wrong; the real key
(`src/lib/default-watchlist.js:20`) is `aruna_watchlist` (underscore, not
hyphen). `aruna-portfolio` is correct (`src/lib/portfolio-storage.js:1`).
Everything else — Context shape, portfolio canonical schema, legacy-key
migration list, trial 60-minute duration — matches the corresponding source
files.

## docs/dependencies.md — ACCURATE

No `framer-motion` entry (already removed, matches `package.json`).
`@supabase/ssr` correctly marked "actively used" with the accurate call site
(`discussions/route.js` `createServerClient()`). Only drift: `yahoo-finance2`
listed as `^3.14.3` vs actual `^4.0.0` in `package.json` — same stale version
as `tech-stack.md`. Otherwise every version number matches `package.json`
exactly.

## docs/integrations.md — ACCURATE

Yahoo Finance concurrency claim ("Concurrency limited to 10 simultaneous
requests in `/api/quotes`") confirmed exact: `CONCURRENCY_LIMIT = 10` at
`src/app/api/quotes/route.js:11`. Pluang CDN flow, Stockbit auth, and Ajaib/
Bibit table usage all match the corresponding lib/route files.

## docs/architecture-decisions.md — WRONG

Three stale ADRs: (1) ADR-001 says XOR encoding applies "except discussions
and cron" — outdated; current code encodes discussions' GET/POST and nearly
all of DELETE (only the config-missing DELETE branch is the real exception,
and it's undocumented as such). (2) ADR-006 claims "Client-side auth only —
no server-side session cookies" — false; `discussions` POST/DELETE use a real
server-side cookie session via `@supabase/ssr`'s `createServerClient()` +
`cookies()`, which `docs/authentication.md` and `CLAUDE.md` both correctly
describe elsewhere. (3) ADR-009 says "Strict CORS origin blocking is
commented out in `src/proxy.js`" — there is no commented-out blocking logic
in `src/proxy.js` at all (verified by reading the full 152-line file); the
function this ADR implies once existed isn't present in any form, commented
or otherwise. ADR-007 (Flutter directory) is accurate and up to date ("has
since been removed... no longer exists at repo root" — confirmed). ADR-008
(hardcoded FX rate) confirmed accurate against `src/lib/msci-calculations.js`.

## docs/known-issues.md — WRONG

Two issues: (1) "CORS Enforcement Is Partial" section says
"Strict origin blocking (`buildUnauthorizedResponse`) is commented out in
`src/proxy.js`" — `buildUnauthorizedResponse` does not exist anywhere in the
current `src/proxy.js` (152 lines, fully read) — not commented out, simply
absent; the doc describes dead code that isn't there, rather than live code
that's inactive. (2) "Resolved in Phase 7" section claims "all
`/api/discussions` error responses now use `payload: encodePayload({ error })`"
— false for the DELETE config-missing branch (route.js:246-249), which is
exactly the same class of bug this entry claims was fixed. The "Money Flow
Cron Truncates" and "Vercel Cron Not Configured" resolved-entries were
verified accurate against `src/app/api/cron/money-flow/route.js` and
`vercel.json`.

## docs/roadmap.md — ACCURATE

Completed-feature checklist matches shipped functionality (spot-checked
error boundaries, screener rate limiting, health endpoint, feature flag —
all present in source). Planned/Future items are clearly marked speculative
(📋/🔮) and don't overstate current state.

## docs/glossary.md — ACCURATE

Vanta.js entry ("used on old landing page, since removed") matches
`git log --all` — the only Vanta-related commit is the one that originally
added it (`2b28ed6`), and no Vanta reference remains in current source.
"Butter-Smooth" comment reference at `mobile-bottom-nav.jsx:71` — file exists
and is the described nav component (exact line wasn't independently
re-verified for the comment text, but the file/component pairing is
correct).

## docs/ai-session-handoff.md — WRONG

Files Modified table (Phase 7 section) claims:
"`src/app/api/discussions/route.js` | All error responses now `payload:
encodePayload({ error })`" — this is the likely origin of the false claim
repeated in `CLAUDE.md`, `api.md`, `architecture.md`, `conventions.md`, and
`known-issues.md`. It's false for the DELETE config-missing branch. The rest
of the Phase 7/8 changelog (files created/modified, validation results) was
spot-checked against actual files (`error.jsx`, `global-error.jsx`,
`toast.jsx`, `src/proxy.js`, `next.config.mjs` headers) and holds up.

## docs/glossary.md, docs/roadmap.md, docs/testing.md, docs/environment.md, docs/deployment.md, docs/ui-architecture.md, docs/application-flow.md, docs/authentication.md, docs/authorization.md, docs/integrations.md, docs/dependencies.md, docs/project-overview.md — see individual entries above (all ACCURATE or ACCURATE-with-caveat)

---

## Verdict Summary

| Verdict | Count | Files |
|---|---|---|
| ACCURATE | 12 | project-overview.md, application-flow.md, authentication.md, authorization.md, environment.md, deployment.md, testing.md, ui-architecture.md, dependencies.md, integrations.md, roadmap.md, glossary.md |
| STALE | 2 | tech-stack.md, folder-structure.md |
| WRONG | 9 | architecture.md, coding-standards.md, conventions.md, api.md, database.md, state-management.md, architecture-decisions.md, known-issues.md, ai-session-handoff.md |
| ASPIRATIONAL | 0 | — |

That's 12 + 2 + 9 = 23 for the `docs/` directory. Adding root `CLAUDE.md`
(also WRONG, for the same discussions-encoding reason as the `docs/` files
above) makes **24 documents audited total, 10 WRONG, 2 STALE, 12 ACCURATE,
0 ASPIRATIONAL**.

No doc in the 22 + CLAUDE.md set describes a feature that was never built
(no ASPIRATIONAL verdicts) — all drift found is docs falling behind shipped
code (STALE) or docs asserting something the code directly contradicts
(WRONG), never the reverse.

---

## Priority Fix List (by blast radius)

1. **The discussions-encoding claim, repeated in 6 files** (`CLAUDE.md`,
   `docs/api.md`, `docs/architecture.md`, `docs/conventions.md`,
   `docs/known-issues.md`, `docs/ai-session-handoff.md`). CLAUDE.md is the
   first file every agent reads, and it states this as a flat architectural
   rule ("`/api/discussions` is included — GET/POST/DELETE all encode their
   responses"). An agent trusting this will not think to XOR-decode-guard
   the DELETE config-missing error path, or will "fix" the DELETE handler in
   a way that assumes today's raw-JSON branch is a bug introduced by someone
   else rather than pre-existing. Fix at the source (`src/app/api/discussions/route.js:246-249`,
   either wrap it in `encodePayload()` to make the docs true, or fix the docs
   to name the one real exception) before touching any of the 6 doc copies.

2. **docs/architecture-decisions.md ADR-006** ("no server-side session
   cookies") and **docs/architecture.md's dependency-flow/encoding claims**
   — these are the docs agents read to understand layer boundaries and auth
   model before writing new code. A wrong claim here (there ARE server
   session cookies, just scoped to discussions) risks an agent designing a
   new authenticated route around the wrong assumption, or missing that
   cookie-session auth is an available/existing pattern.

3. **docs/architecture-decisions.md ADR-009 and docs/known-issues.md's
   CORS section** — both describe `buildUnauthorizedResponse` as "commented
   out" in `src/proxy.js`, but the function doesn't exist in any form. An
   agent asked to "re-enable strict CORS blocking" would go looking for
   commented code to uncomment and find nothing, wasting a debugging cycle
   before realizing the docs describe a state of the file that predates a
   full rewrite.

4. **docs/database.md's "DROP TABLE IF EXISTS" claim** — inverts the actual
   migration safety model (`create table if not exists`, no drops). This is
   dangerous specifically because it's a database doc: an agent trusting it
   might assume re-running `setup.sql` is destructive when it isn't, or
   conversely feel free to re-run it against prod believing tables get
   dropped and cleanly recreated when in fact `IF NOT EXISTS` means schema
   changes silently no-op against an existing table.

5. **docs/conventions.md and docs/state-management.md's `aruna-watchlist` vs
   `aruna_watchlist` key mismatch** — smaller blast radius (one wrong string
   in a reference table) but concrete: an agent implementing a new
   guest-data feature that reads this table verbatim would read/write the
   wrong localStorage key and silently fail to find the user's actual
   watchlist data.

6. **docs/coding-standards.md's "no global error boundary"** — inconsistent
   with the codebase's own `known-issues.md` Phase 7 section three docs
   over; low risk since it only affects an agent deciding whether to add
   error-boundary code (they'd likely check for existing ones anyway), but
   still a direct code-vs-doc contradiction within the same doc set.

7. **docs/tech-stack.md / docs/dependencies.md yahoo-finance2 version
   (^3.14.3 vs actual ^4.0.0)** and **docs/folder-structure.md missing
   `mini-chart.jsx`/`toast.jsx`** — lowest priority; version-number and
   file-tree staleness that doesn't mislead architectural decisions, just
   needs a routine sync pass.

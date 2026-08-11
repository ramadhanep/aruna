# Tech Debt Audit

Read-only audit against the layer/encoding rules in `CLAUDE.md`. No source files were modified. Findings are grouped by category; each carries an explicit severity tag. Line numbers are accurate as of the commit at audit time (`d050c9e`).

## Missing safeguards (encodePayload / RLS / env)

- **[Critical]** `src/app/api/msci/route.js:52-59` — the "no MSCI stocks found" success branch returns a fully raw JSON body (`{ stocks: [], summary: {...}, lastUpdated }`) with no `encodePayload()` at all, unlike every other success branch in the file (line 168-174). This is a genuine payload-shape bug, not just an obfuscation gap: a client that only understands the encoded envelope (`{ payload: "..." }`) will fail to parse this response via `fetchEncodedJson()` (falls into the `body.error` string check in `src/lib/api-client.js:16`, then throws `'Failed to decode API response'` since there's no `.error` field either). Fix: wrap in `encodePayload()` like the rest of the route.
- **[High]** Four routes wrap only their *success* path in `encodePayload()` but return raw `{ error }` JSON on every error branch, inconsistent with the pattern used in `finance`, `price-series`, `quotes`, `fundamentals`, `screeners`, `symbol-search`, `delete-account`, and (mostly) `discussions`:
  - `src/app/api/bubbles/route.js:19-22, 47-50, 71-74`
  - `src/app/api/momentum/route.js:44-47, 65-68, 140-143`
  - `src/app/api/msci/route.js:20-23, 45-48, 72-75, 178-181`
  - `src/app/api/rotation/route.js:19-22, 37-40, 105-108`
  All four import `encodePayload` and use it correctly for the 200 path, so this reads as a copy-paste gap rather than a deliberate exception — none of these routes are documented exceptions in `docs/api.md` (only `/api/cron/*` and `/api/health` are). Fix: wrap every `NextResponse.json({ error, ... })` in these files the same way `finance/route.js` does (`{ payload: encodePayload({ error }) }`).
- **[Medium]** `src/app/api/discussions/route.js:246-249` — the `DELETE` handler's "Supabase configuration missing" branch returns raw `{ error }` JSON. This directly contradicts `docs/known-issues.md:96-98`, which states the Phase 7 fix made **all** `/api/discussions` error responses (GET/POST/DELETE) use `encodePayload()`. Every other error branch in this file (GET, POST, and the rest of DELETE) is correctly wrapped — this one branch was missed. Low practical impact since `fetchEncodedJson()` has a documented fallback for unencoded `{ error }` bodies (`src/lib/api-client.js:14-18`), but it's a live contradiction of the docs and the architecture rule.
- **[Low]** RLS / schema check: every table referenced via `.from('...')` in `src/app` and `src/lib` (`profiles`, `watchlists`, `portfolios`, `stock_universes`, `screening_snapshots`, `trending_stocks`, `msci_stocks`, `msci_snapshot_cache`, `ajaib_stocks`, `bibit_stocks`, `discussion_messages`, `money_flow_reports`, `weekly_reports`) exists in `supabase/setup.sql` with `enable row level security` + at least one `create policy`. No missing-RLS gap found — this area is clean, no action needed.

## Dead / duplicated code

- **[Medium]** `src/components/ui/sidebar.jsx` (680 lines) and `src/components/ui/radio-group.jsx` (38 lines) — orphaned shadcn scaffold components. Neither `Sidebar*` nor `RadioGroup` (the primitive, as opposed to `DropdownMenuRadioGroup`) is imported anywhere in `src/app` or `src/components`. 718 lines of dead UI-kit code. Fix: delete both files, or confirm they're intentionally kept as scaffolding for a future feature (in which case note it explicitly, per YAGNI this should just go).
- **[Low]** Five exported `lib` functions have zero call sites outside their own definition (only match is the `export function` line itself):
  - `isCryptoTicker` — `src/lib/chart-helpers.js:297`
  - `dayOfYearToMonthDate` — `src/lib/seasonalData.js:132`
  - `sortByNearestInclusion` — `src/lib/msci-calculations.js:149`
  - `calculateSummaryStats` — `src/lib/msci-calculations.js:158`
  - `formatDecimalPercent` — `src/lib/utils.js:123`
  Likely leftovers from refactors (e.g. `msci/route.js` computes its own inline `calculateStats` at `src/app/api/msci/route.js:149-156` instead of the lib's `calculateSummaryStats` — see next item). Fix: delete if truly unused, or wire up the caller that was supposed to use them.
- **[Medium]** `src/app/api/msci/route.js:149-156` defines a local `calculateStats(stocks)` helper that duplicates `calculateSummaryStats()` already exported from `src/lib/msci-calculations.js:158` (same shape: `totalStocks`, progress/free-float aggregation). This is the API-route counterpart of the dead-export finding above — the lib function exists but the route reimplements it inline instead of importing it. Fix: import and use `calculateSummaryStats` from the lib, delete the inline copy.
- **[Medium]** `src/app/chart/page.jsx:562-568` (`formatPriceValue`) and `src/app/chart/page.jsx:585-601` (`formatPlainNumber`) both reimplement `formatPrice(value, { locale: 'en-US', minimumFractionDigits: 2, maximumFractionDigits: 2 })` from `src/lib/utils.js:82-95`, which already accepts these exact options. The two local functions are also near-duplicates of *each other* within the same file (both do `Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`, `formatPlainNumber` just adds a string-coercion branch). Fix: replace both with calls to the existing `formatPrice()`.
- **[Low]** `docs/known-issues.md:8-9` describes "Strict origin blocking (`buildUnauthorizedResponse`) is commented out in `src/proxy.js`" — but `src/proxy.js` (read in full) contains no `buildUnauthorizedResponse` function or any commented-out origin-blocking code at all; the file only has the live rate-limiter and the (working, uncommented) decorative CORS logic. This isn't undocumented dead code in the source — it's the reverse: documented dead code that no longer exists in the source, i.e. the doc is stale relative to the file it describes.

## Business logic outside lib/

No misplaced scoring/threshold logic found. Money-flow scoring (`src/lib/money-flow.js`), MSCI thresholds (`src/lib/msci-calculations.js`), and seasonal math (`src/lib/seasonalData.js`) are correctly centralized and consumed as-is by API routes and pages/hooks — the only leakage found is the `calculateStats` duplication noted above, which is a duplication issue rather than logic living exclusively outside `lib/`.

## Architecture violations

No dependency-flow violations found:
- No `src/components/*` or `src/lib/*` file imports from `src/app/api/*`.
- No `src/lib/*` file imports from `src/components/*` or `src/app/*`.
- No raw `fetch('/api/...')` calls in components bypassing `fetchEncodedJson()`.
- No page directly imports `yahoo-finance2` or calls Supabase for data mutations outside `src/lib/*` wrappers; the one direct `getSupabaseBrowserClient()` use in `src/app/discussion/page.jsx:253` is for a Realtime channel subscription, which must run client-side and is not a data-fetch bypass of the API layer.

This area is clean — the codebase is actually disciplined about the pages -> components -> lib flow.

## Already-tracked (not re-reported as new)

- `chart/page.jsx` (2772 lines), `explore/page.jsx` (1421 lines), `portfolio-tracker/page.jsx` (1012 lines) remain large per `docs/known-issues.md`, but sizes have not grown meaningfully since that doc was written (chart is smaller than the ~2780 cited there; portfolio-tracker is smaller than the ~1190 cited there). No new large-file regressions found beyond the specific duplication items called out above.
- Hardcoded `USD_TO_IDR` in `src/lib/msci-calculations.js` and `DEFAULT_SCREENER_TEMPLATE_ID` in the money-flow cron are already documented in `docs/known-issues.md` — not re-listed here.

---

## Top 5 shortlist (risk x frequency-of-touch, effort-tagged)

1. **[S]** Fix `src/app/api/msci/route.js:52-59` empty-state branch to use `encodePayload()` — one-line-ish change, but it's an actual response-shape bug on a route the `/explore` and `/msci-tracker` pages hit regularly whenever the DB table is empty or filtered to nothing.
2. **[S]** Wrap error branches in `bubbles`, `momentum`, `msci`, `rotation` routes with `encodePayload()` (12 call sites total, same one-line pattern each) — closes a real, currently-reproducible violation of the project's own "every response except cron/health must be encoded" rule, and these are player-facing routes (explore, bubbles, momentum, MSCI, rotation pages) touched often.
3. **[S]** Fix the one missed branch in `src/app/api/discussions/route.js:246-249` — brings the file back in line with what `docs/known-issues.md` already claims is true; trivial diff, closes a doc/code mismatch.
4. **[M]** Delete `src/components/ui/sidebar.jsx` + `radio-group.jsx` (718 dead lines) and the 5 dead lib exports — pure deletion, zero behavior risk, reduces surface area newcomers have to read through.
5. **[M]** Dedupe `formatPriceValue`/`formatPlainNumber` in `chart/page.jsx` onto `lib/utils.js#formatPrice`, and swap the inline `calculateStats` in `msci/route.js` for the existing `calculateSummaryStats` — `chart/page.jsx` is the single most-edited file in this codebase per `docs/known-issues.md`, so any duplicated logic there compounds every time someone touches formatting again.

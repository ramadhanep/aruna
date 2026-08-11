---
description: Run tech-debt and UI audits over the current codebase
---

Run three agents against the current codebase (in parallel, since they're independent read-only scans):

1. `tech-debt-auditor` — architecture violations, dead code, business logic outside `src/lib/`, missing `encodePayload()`, RLS gaps. Output: `docs/TECH_DEBT.md`.
2. `ui-polish-specialist` (read-only mode — findings only, no edits) — Tailwind class sprawl, missing skeleton/shimmer coverage, spacing inconsistency, generic-AI-UI tells to avoid. Output: `docs/UI_AUDIT.md`.
3. `shadcn-migrator` (read-only audit mode) — shadcn/ui coverage per page/component, hand-rolled markup that a primitive (`ui/*`) already covers, raw `<input>`/`<button>` stragglers, unused primitives. Output: `docs/SHADCN_MIGRATION.md` (see `/shadcn-audit`).

All three are read-only for this command — none should edit source code or docs/ content beyond writing their own report file.

After all finish:
1. Summarize each report's top 5 findings by severity/effort.
2. Note any overlap between the three reports (e.g. a component flagged in both `UI_AUDIT` and `SHADCN_MIGRATION` — usually means it needs one pass, not two).
3. Recommend whether `/plan` should run next, or whether `/docs-audit` should run first if it hasn't yet (stale docs make tech-debt findings less trustworthy, since they may cite outdated architecture claims).

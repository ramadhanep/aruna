---
description: Run tech-debt and UI audits over the current codebase
---

Run two agents against the current codebase (in parallel, since they're independent read-only scans):

1. `tech-debt-auditor` — architecture violations, dead code, business logic outside `src/lib/`, missing `encodePayload()`, RLS gaps. Output: `docs/TECH_DEBT.md`.
2. `ui-polish-specialist` (read-only mode — findings only, no edits) — Tailwind class sprawl, missing skeleton/shimmer coverage, spacing inconsistency, generic-AI-UI tells to avoid. Output: `docs/UI_AUDIT.md`.

Both are read-only for this command — neither should edit source code or docs/ content beyond writing their own report file.

After both finish:
1. Summarize each report's top 5 findings by severity/effort.
2. Note any overlap between the two reports (e.g. a component flagged in both for different reasons).
3. Recommend whether `/plan` should run next, or whether `/docs-audit` should run first if it hasn't yet (stale docs make tech-debt findings less trustworthy, since they may cite outdated architecture claims).

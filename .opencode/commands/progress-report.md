---
description: Summarize maintenance progress (full or incremental)
argument-hint: [full|incremental]
---

Produce a progress summary for the current maintenance work.

Mode is "$ARGUMENTS" (default: incremental if omitted).

**Incremental mode**: only cover phases touched since the last `docs/PROGRESS_REPORT.md` was written (check its own "Last updated" line, or fall back to `git log` on `docs/MAINTENANCE_PLAN.md` since that timestamp). Short — what changed, what's next.

**Full mode**: cover every phase in the plan from the start. Include:
- Completion percentage per phase (checked items / total).
- Any phase item whose scope changed during execution, and why.
- Cumulative docs-drift status: are `docs/DOCS_DRIFT_REPORT.md` findings still open, or have they been resolved by completed phases?
- Any new drift introduced by the maintenance work itself (a phase that changed code but not the doc describing it) — spot-check this rather than assuming it's clean.

End with:
- **Next recommended phase** (the first unblocked, unchecked phase in the plan).
- **Last updated**: today's date, so future incremental runs know where to start.

Read-only against source and docs/ content other than the report file itself and the "Last updated" stamp.

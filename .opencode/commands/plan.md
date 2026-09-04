---
description: Combine drift/debt/UI reports into a phased maintenance plan
---

Read `docs/TECH_DEBT.md` and `docs/UI_AUDIT.md` (run `/audit` first if any are missing — tell the user which is missing rather than guessing at their contents).

Synthesize all three into `docs/MAINTENANCE_PLAN.md`, organized into phases. Group by dependency and blast radius, not by source report — e.g. a docs fix that unblocks correct tech-debt understanding goes before the tech-debt item it affects.

For each phase:
- **Goal**: one sentence.
- **Items**: checklist (`- [ ] item — file(s) touched`), each tagged with effort (S/M/L) and priority (P0/P1/P2).
- **Depends on**: prior phase name, or "none".

Ordering heuristics specific to this project:
- Doc corrections that other docs/OPENCODE.md rules depend on (e.g. the `/api/discussions` encoding claim, since `OPENCODE.md` states it as an architectural exception other work will assume) come first — fixing the doc is cheap and prevents every later phase from inheriting a wrong assumption.
- Architecture/tech-debt fixes that touch shared code (`src/lib/*`, `src/middleware.js`) come before UI polish, since UI work in the same files would conflict.
- PWA safe-area/viewport fixes are low-risk, high-visible-impact — good early "quick win" phase.
- Large page refactors (`chart/page.jsx`, `explore/page.jsx`, `portfolio-tracker/page.jsx`) are their own late phase — high effort, do after quicker wins build confidence.
- Never bundle a `docs/` update with unrelated source changes in the same phase item — each item should be independently reviewable.

End the file with an `## Unresolved questions` section for anything that needs the user's judgment call before a phase can be scoped (e.g. "should middleware CORS blocking be re-enabled, or is permissive-by-design intentional?").

Do not start executing any phase — that's `/execute-phase`.

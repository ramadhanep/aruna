---
description: Execute one phase from docs/MAINTENANCE_PLAN.md
argument-hint: <phase-name>
---

Execute phase "$ARGUMENTS" from `docs/MAINTENANCE_PLAN.md`. If the plan doesn't exist yet, tell the user to run `/plan` first — don't improvise a phase from scratch.

Steps:

1. Read `docs/MAINTENANCE_PLAN.md` and locate the named phase. If the name doesn't match exactly, show the available phase names and ask which one was meant — don't guess.
2. Read every item in the phase and the files it touches. Check "Depends on" — if the dependency phase isn't checked off yet, warn the user before proceeding.
3. Enter plan mode before editing anything. Present the concrete diff-level plan for every item in the phase (not a re-statement of the plan file — the actual approach per file).
4. On approval, execute. Use `docs-sync-auditor`/`tech-debt-auditor`/`ui-polish-specialist`/`pwa-specialist` as appropriate to the phase's content, or edit directly for small items — match tool choice to item size, don't spawn an agent for a one-line fix.
5. Keep the relevant docs in sync as you go: update `docs/environment.md` for new env vars, update `docs/api.md` for new/changed routes, update `docs/database.md` and `supabase/setup.sql` together for schema changes, update `docs/dependencies.md` for new packages.
6. Run `npm run lint` before considering the phase done.
7. Update `docs/MAINTENANCE_PLAN.md`: check off completed items in the phase, note any item that was skipped or changed scope and why.
8. Update `docs/ai-session-handoff.md` if the work materially changes the current session notes.

Never touch `public/sw.js` without bumping `VERSION` and checking the cache-strategy doc. Never skip the plan-mode confirmation step, even if the phase looks small.

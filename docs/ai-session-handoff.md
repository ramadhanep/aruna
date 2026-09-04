# Session Handoff

Short working notes for continuing a session.

## Current State

- Aruna is a mobile-first stock analysis app.
- Main stack: Next.js 16, React 19, Supabase, Tailwind CSS v4.
- `README.md` is the public entry point.
- `OPENCODE.md` is the local agent guide.

## What To Check First

- `README.md`
- `docs/architecture.md`
- `docs/folder-structure.md`
- `docs/conventions.md`
- `docs/api.md`
- `docs/database.md`

## Safe Working Rules

- Keep the layer flow: pages -> components -> lib.
- Keep API route behavior consistent with docs.
- Prefer the smallest correct change.
- Update docs when behavior changes.
- Use `@/` imports.
- Use `cn()` for class merging.
- Use `fetchEncodedJson()` for API calls.

## Notes

- This file is for short handoff only.
- Move old session history to an archive file if needed.

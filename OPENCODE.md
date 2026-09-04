# OpenCode Session Guide

Use this repo with the current workspace context.

## Read First

- `README.md`
- `docs/architecture.md`
- `docs/conventions.md`
- `docs/folder-structure.md`
- `docs/api.md`
- `docs/database.md`

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Rules

- Preserve the current layer flow: pages -> components -> lib
- Keep API payload encoding intact outside cron routes
- Prefer the smallest correct change
- Update docs when code behavior changes
- Do not add new abstractions unless needed

## Working Style

- Use `@/` imports
- Use `cn()` for class merging
- Use `fetchEncodedJson()` for API calls
- Keep changes reviewable and minimal

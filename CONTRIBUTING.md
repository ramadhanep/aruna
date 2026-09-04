# Contributing

## Setup

```bash
npm install
npm run dev
```

## Before You Open a PR

```bash
npm run lint
npm run test
```

## Rules

- Keep changes small.
- Follow the existing layer flow: pages -> components -> lib.
- Do not import API routes from components.
- Keep API payload encoding intact outside cron routes.
- Update docs when behavior changes.
- Keep `supabase/setup.sql` aligned with schema changes.

## Style

- Use `@/` imports.
- Use `cn()` for class merging.
- Prefer existing components over new abstractions.
- Avoid churn unless it removes real complexity.

## Good PRs

- One concern per PR.
- Include tests when logic changes.
- Mention user-facing changes clearly.

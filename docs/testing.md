# Testing

## Current State

**No testing infrastructure is configured.**

- No test runner (Jest, Vitest, Playwright, etc.).
- No test files exist in `src/`.
- The `test/` directory referenced in `package.json` does not exist.
- No CI pipeline for automated testing.

## Scripts

`package.json` defines only:
- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production start
- `npm run lint` — ESLint

No test scripts are defined.

## Manual Testing Approach

Currently, testing is done manually:
- Development server at `http://localhost:3000`.
- API routes tested via `curl` or Bruno (API collection in `aruna-api.json`).
- Cron jobs triggered manually via `curl -H "Authorization: Bearer <secret>" http://localhost:3000/api/cron/idx`.

## Future Recommendations

- Add Jest/Vitest for unit tests (especially `lib/` calculations).
- Add Playwright for E2E tests.
- Add API route integration tests.
- Add Supabase local emulator for DB tests.

# Architecture Decisions

## ADR-001: XOR Response Obfuscation

- Accepted
- Obfuscation only, not security
- Used for API responses except cron routes

## ADR-002: Local-First User Data

- Accepted
- Watchlist and portfolio default to localStorage
- Supabase sync is optional

## ADR-003: Plain JavaScript

- Accepted
- No TypeScript
- Keep JS unless a real need appears

## ADR-004: No State Library

- Accepted
- React Context + localStorage is enough for now

## ADR-005: API Routes as Proxy

- Accepted
- External APIs stay server-side

## ADR-006: Supabase Auth

- Accepted
- Google OAuth via Supabase

## ADR-007: Flutter App Removed

- Superseded
- Archived as history

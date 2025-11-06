# Aruna

Mobile-first seasonal market companion with local-first storage and optional Supabase sync.

## Getting Started

```bash
npm install
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000) by default.

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` using the Supabase SQL editor.
3. In the Supabase dashboard, register a Google OAuth provider under **Authentication → Providers**.
4. Add the following environment variables (for example in `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

The anon key is used in the browser for Google SSO and syncing watchlist/portfolio data. The service role key is only read on the server to handle account deletion.

## Features

- Watchlist and portfolio stored locally with optional Supabase backup.
- Google single-sign-on using Supabase Auth.
- Account screen to manage session, theme, data reset, and account deletion.
- Sensitive analytics (Earnings Results, Revenue vs Earnings) require authentication and are blurred for guest users.

## Data Model

The schema stores user documents as JSON blobs for simplicity:

- `profiles` – cache of Supabase auth metadata.
- `watchlists` – array of tracked symbols per user.
- `portfolios` – array of portfolio entries per user.

Row Level Security restricts access to the owning user; see `supabase/schema.sql` for full definitions and indices.

## Environment Notes

- Without Supabase keys the app falls back to local-only mode; sign-in and cloud sync controls show helper messaging.
- `process.env.NEXT_PUBLIC_APP_VERSION` is displayed on the account screen; default is `1.0.0` if unset.

-- Supabase schema for aruna app

-- Profiles table keeps a denormalised copy of auth metadata
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Stores the full watchlist payload per user
create table if not exists public.watchlists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- Stores the entire portfolio document per user
create table if not exists public.portfolios (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.portfolios enable row level security;

-- Allow users to read and maintain their own profile row
create policy "Users can view profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can upsert profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Watchlist policies
create policy "Users manage their watchlist" on public.watchlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Portfolio policies
create policy "Users manage their portfolio" on public.portfolios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helpful indexes for updated_at sorting if needed
create index if not exists watchlists_updated_at_idx on public.watchlists (updated_at desc);
create index if not exists portfolios_updated_at_idx on public.portfolios (updated_at desc);

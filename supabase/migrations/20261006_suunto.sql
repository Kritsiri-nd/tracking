-- Additive migration: do not run the legacy schema.sql ownership migration.
create table if not exists public.suunto_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  tokens text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.suunto_connections add column if not exists last_api_at timestamptz;
create table if not exists public.suunto_oauth_states (
  state text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists public.suunto_notifications (
  username text not null,
  workout_key text not null,
  created_at timestamptz not null default now(),
  primary key(username, workout_key)
);
alter table public.suunto_connections enable row level security;
alter table public.suunto_oauth_states enable row level security;
alter table public.suunto_notifications enable row level security;
-- Tokens and OAuth state are accessed only by the server service role.
revoke all on public.suunto_connections, public.suunto_oauth_states, public.suunto_notifications from anon, authenticated;

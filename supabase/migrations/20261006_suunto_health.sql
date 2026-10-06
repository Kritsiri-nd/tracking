create table if not exists public.suunto_health_samples (
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('activity','sleep','recovery','daily')),
  external_key text not null,
  recorded_at timestamptz not null,
  entry_data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(owner_id,kind,external_key)
);
create index if not exists suunto_health_owner_time on public.suunto_health_samples(owner_id,recorded_at);
create table if not exists public.suunto_health_sync (
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('activity','sleep','recovery','daily')),
  synced_at timestamptz not null,
  range_from timestamptz not null,
  range_to timestamptz not null,
  sample_count integer not null default 0,
  primary key(owner_id,kind)
);
alter table public.suunto_health_samples enable row level security;
alter table public.suunto_health_sync enable row level security;
revoke all on public.suunto_health_samples,public.suunto_health_sync from anon,authenticated;
grant all on public.suunto_health_samples,public.suunto_health_sync to service_role;

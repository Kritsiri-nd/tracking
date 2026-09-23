-- Stridebook database schema
-- One account owns all training data. The migration section also converts the
-- original shared runner model and assigns existing rows to James.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default 'Runner',
  max_hr integer not null default 190 check (max_hr between 100 and 240),
  resting_hr integer check (resting_hr between 30 and 120),
  birth_date date,
  height_cm numeric(5,1) check (height_cm between 80 and 250),
  weight_kg numeric(5,1) check (weight_kg between 20 and 300),
  running_goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shoes (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  model text,
  max_distance_km numeric(8,2) not null default 800 check (max_distance_km > 0),
  retired boolean not null default false,
  image_storage_path text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planned_workouts (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  title text not null,
  type text not null,
  target_distance_km numeric(8,2),
  target_duration_sec integer,
  pace_min_sec_per_km integer,
  pace_max_sec_per_km integer,
  status text not null default 'planned' check (status in ('planned', 'completed', 'partial', 'exceeded', 'missed', 'postponed')),
  postponed_from date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  started_at timestamptz,
  title text,
  type text not null,
  source text not null default 'manual' check (source in ('manual', 'fit', 'gpx', 'garmin', 'strava', 'other')),
  distance_km numeric(8,3) not null default 0 check (distance_km >= 0),
  duration_sec integer check (duration_sec >= 0),
  pace_sec_per_km numeric(8,2),
  avg_heart_rate integer,
  max_heart_rate integer,
  avg_cadence numeric(8,2),
  elevation_gain_m numeric(8,2),
  calories integer,
  shoe_id text references public.shoes(id) on delete set null,
  rpe integer check (rpe between 1 and 10),
  note text,
  imported_file_name text,
  fit_storage_path text,
  gpx_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_laps (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id) on delete cascade,
  lap_number integer not null check (lap_number > 0),
  distance_km numeric(8,3),
  duration_sec integer,
  pace_sec_per_km numeric(8,2),
  avg_heart_rate integer,
  created_at timestamptz not null default now(),
  unique (activity_id, lap_number)
);

create table if not exists public.activity_points (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id) on delete cascade,
  point_index integer,
  distance_km numeric(8,3),
  latitude double precision,
  longitude double precision,
  elevation_m numeric(8,2),
  pace_sec_per_km numeric(8,2),
  heart_rate integer,
  cadence integer,
  temperature_c numeric(5,2),
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (activity_id, point_index)
);

create table if not exists public.monthly_goals (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null check (date_trunc('month', month_start)::date = month_start),
  target_distance_km numeric(8,2),
  target_sessions integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, month_start)
);

-- Existing database migration: add ownership, move every existing row to the
-- James account, then remove the obsolete shared runner/person model.
alter table public.shoes add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.planned_workouts add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.activities add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.activity_laps add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.activity_points add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.monthly_goals add column if not exists owner_id uuid references auth.users(id) on delete cascade;

update public.shoes set owner_id = '7dbc1376-231a-4460-bd39-da7e2087ceed'::uuid;
update public.planned_workouts set owner_id = '7dbc1376-231a-4460-bd39-da7e2087ceed'::uuid;
update public.activities set owner_id = '7dbc1376-231a-4460-bd39-da7e2087ceed'::uuid;
update public.activity_laps set owner_id = '7dbc1376-231a-4460-bd39-da7e2087ceed'::uuid;
update public.activity_points set owner_id = '7dbc1376-231a-4460-bd39-da7e2087ceed'::uuid;
update public.monthly_goals set owner_id = '7dbc1376-231a-4460-bd39-da7e2087ceed'::uuid;

alter table public.shoes alter column owner_id set not null;
alter table public.planned_workouts alter column owner_id set not null;
alter table public.activities alter column owner_id set not null;
alter table public.activity_laps alter column owner_id set not null;
alter table public.activity_points alter column owner_id set not null;
alter table public.monthly_goals alter column owner_id set not null;

alter table public.shoes drop constraint if exists shoes_person_id_fkey;
alter table public.planned_workouts drop constraint if exists planned_workouts_person_id_fkey;
alter table public.activities drop constraint if exists activities_person_id_fkey;
alter table public.monthly_goals drop constraint if exists monthly_goals_person_id_fkey;
alter table public.shoes drop column if exists person_id cascade;
alter table public.planned_workouts drop column if exists person_id cascade;
alter table public.activities drop column if exists person_id cascade;
alter table public.monthly_goals drop column if exists person_id cascade;
drop table if exists public.runners;
drop function if exists public.claim_unowned_stridebook_data();

drop index if exists planned_workouts_person_date_idx;
drop index if exists activities_person_date_idx;
drop index if exists monthly_goals_person_month_idx;
create index if not exists shoes_owner_idx on public.shoes (owner_id);
create index if not exists planned_workouts_owner_date_idx on public.planned_workouts (owner_id, scheduled_date);
create index if not exists activities_owner_date_idx on public.activities (owner_id, activity_date desc);
create index if not exists activity_laps_owner_activity_idx on public.activity_laps (owner_id, activity_id, lap_number);
create index if not exists activity_points_owner_activity_idx on public.activity_points (owner_id, activity_id, point_index);
create index if not exists monthly_goals_owner_month_idx on public.monthly_goals (owner_id, month_start desc);

alter table public.profiles enable row level security;
alter table public.shoes enable row level security;
alter table public.planned_workouts enable row level security;
alter table public.activities enable row level security;
alter table public.activity_laps enable row level security;
alter table public.activity_points enable row level security;
alter table public.monthly_goals enable row level security;

drop policy if exists "profile owner access" on public.profiles;
create policy "profile owner access" on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "dev anon full access" on public.shoes;
drop policy if exists "owner access" on public.shoes;
create policy "owner access" on public.shoes for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "dev anon full access" on public.planned_workouts;
drop policy if exists "owner access" on public.planned_workouts;
create policy "owner access" on public.planned_workouts for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "dev anon full access" on public.activities;
drop policy if exists "owner access" on public.activities;
create policy "owner access" on public.activities for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "dev anon full access" on public.activity_laps;
drop policy if exists "owner access" on public.activity_laps;
create policy "owner access" on public.activity_laps for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "dev anon full access" on public.activity_points;
drop policy if exists "owner access" on public.activity_points;
create policy "owner access" on public.activity_points for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "dev anon full access" on public.monthly_goals;
drop policy if exists "owner access" on public.monthly_goals;
create policy "owner access" on public.monthly_goals for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on public.profiles, public.shoes, public.planned_workouts, public.activities,
  public.activity_laps, public.activity_points, public.monthly_goals from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.shoes, public.planned_workouts,
  public.activities, public.activity_laps, public.activity_points, public.monthly_goals to authenticated;
grant usage, select on all sequences in schema public to authenticated;

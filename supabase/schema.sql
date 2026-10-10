-- WULU Scanner — Supabase schema (run in SQL editor)
-- Auth users come from Supabase Auth; profiles extend them.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  plan_tier text not null default 'free'
    check (plan_tier in ('free', 'basic', 'standard', 'premium', 'ultra')),
  credits_balance integer not null default 20 check (credits_balance >= 0),
  credits_reset_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

create table if not exists public.signal_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('LONG', 'SHORT')),
  recommendation text not null,
  confidence text not null,
  brief text not null,
  credits_charged integer not null default 0,
  setup_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists signal_recommendations_user_created_idx
  on public.signal_recommendations (user_id, created_at desc);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, plan_tier, credits_balance)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'free',
    20
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.signal_recommendations enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own_display" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);

create policy "recs_select_own" on public.signal_recommendations
  for select using (auth.uid() = user_id);

-- Service role (API) bypasses RLS for credit deduction / plan assignment.

-- Phase 2 — multi-stock monitor persistence (also in migrations/20261011_phase2_monitor.sql)
create table if not exists public.monitor_watchlists (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  symbols jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.monitor_alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null,
  side text not null default 'LONG',
  previous_status text not null,
  new_status text not null,
  setup_id text not null,
  event_at timestamptz not null default now(),
  market_data_at timestamptz,
  trigger_level double precision,
  entry_zone jsonb,
  stop_level double precision,
  target1 double precision,
  target2 double precision,
  data_fresh boolean not null default false,
  reason text not null default '',
  confirmation_details jsonb not null default '[]'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint monitor_alert_events_dedupe unique (dedupe_key)
);

create index if not exists monitor_alert_events_user_event_idx
  on public.monitor_alert_events (user_id, event_at desc);

alter table public.monitor_watchlists enable row level security;
alter table public.monitor_alert_events enable row level security;

drop policy if exists "monitor_watchlists_select_own" on public.monitor_watchlists;
create policy "monitor_watchlists_select_own" on public.monitor_watchlists
  for select using (auth.uid() = user_id);

drop policy if exists "monitor_alerts_select_own" on public.monitor_alert_events;
create policy "monitor_alerts_select_own" on public.monitor_alert_events
  for select using (auth.uid() = user_id);

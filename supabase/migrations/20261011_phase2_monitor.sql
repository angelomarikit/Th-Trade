-- Phase 2 — persistent multi-stock watchlists + alert event log
-- Safe to re-run (IF NOT EXISTS). Apply in Supabase SQL editor or CLI.

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

-- Service role (API) bypasses RLS for upserts / inserts.

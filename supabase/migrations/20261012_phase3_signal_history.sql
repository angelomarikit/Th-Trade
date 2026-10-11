-- Phase 3/4 foundation — durable signal history + alert preferences
-- Safe to re-run. Apply in Supabase SQL editor or CLI.
-- Does NOT enable SMS/email push; delivery columns support future channels.

create table if not exists public.signal_performance_records (
  id text primary key,
  user_id uuid references public.profiles (id) on delete set null,
  symbol text not null,
  side text not null default 'LONG',
  strategy_type text not null default 'SCANNER',
  setup_id text not null,
  signal_timestamp timestamptz not null,
  data_timestamp timestamptz,
  market_session text,
  trigger_level double precision,
  entry_zone jsonb,
  stop_level double precision,
  target1 double precision,
  target2 double precision,
  target3 double precision,
  quality_score_10 integer,
  setup_score_100 integer,
  false_breakout_risk text,
  state text not null,
  actionable boolean not null default false,
  data_quality_ok boolean not null default false,
  confirmation_summary jsonb not null default '[]'::jsonb,
  outcome_status text not null default 'UNKNOWN',
  outcome_r double precision,
  source text not null default 'LIVE',
  live_validated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists signal_performance_records_user_ts_idx
  on public.signal_performance_records (user_id, signal_timestamp desc);

create index if not exists signal_performance_records_symbol_ts_idx
  on public.signal_performance_records (symbol, signal_timestamp desc);

create index if not exists signal_performance_records_source_idx
  on public.signal_performance_records (source, signal_timestamp desc);

alter table public.signal_performance_records enable row level security;

drop policy if exists "signal_performance_select_own" on public.signal_performance_records;
create policy "signal_performance_select_own" on public.signal_performance_records
  for select using (auth.uid() = user_id);

create table if not exists public.user_alert_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_enabled boolean not null default true,
  browser_enabled boolean not null default false,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_alert_preferences enable row level security;

drop policy if exists "user_alert_preferences_select_own" on public.user_alert_preferences;
create policy "user_alert_preferences_select_own" on public.user_alert_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "user_alert_preferences_upsert_own" on public.user_alert_preferences;
create policy "user_alert_preferences_upsert_own" on public.user_alert_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.monitor_alert_events
  add column if not exists delivery_status text not null default 'recorded';

alter table public.monitor_alert_events
  add column if not exists delivery_channels jsonb not null default '[]'::jsonb;

alter table public.monitor_alert_events
  add column if not exists delivered_at timestamptz;

-- Service role (API) bypasses RLS for inserts / upserts.

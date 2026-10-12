-- Phase 4 — durable open signal tracks + alert dedupe resilience
-- Safe to re-run. Service role bypasses RLS.

create table if not exists public.open_signal_tracks (
  id text primary key,
  user_id uuid references public.profiles (id) on delete set null,
  symbol text not null,
  side text not null default 'LONG',
  setup_id text not null,
  entry_price double precision not null,
  entry_at timestamptz not null,
  stop_level double precision not null,
  target1 double precision not null,
  target2 double precision not null,
  target3 double precision,
  source text not null default 'LIVE',
  bars_elapsed integer not null default 0,
  quality_score_10 integer,
  strategy_type text not null default 'SCANNER',
  status text not null default 'OPEN',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists open_signal_tracks_status_idx
  on public.open_signal_tracks (status, updated_at desc);

create index if not exists open_signal_tracks_user_idx
  on public.open_signal_tracks (user_id, status);

alter table public.open_signal_tracks enable row level security;

drop policy if exists "open_signal_tracks_select_own" on public.open_signal_tracks;
create policy "open_signal_tracks_select_own" on public.open_signal_tracks
  for select using (auth.uid() = user_id);

-- Recent dedupe keys so alert spam cannot recur after Railway restart
create table if not exists public.monitor_alert_dedupe (
  dedupe_key text primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  event_id uuid,
  seen_at timestamptz not null default now()
);

create index if not exists monitor_alert_dedupe_seen_idx
  on public.monitor_alert_dedupe (seen_at desc);

alter table public.monitor_alert_dedupe enable row level security;

drop policy if exists "monitor_alert_dedupe_select_own" on public.monitor_alert_dedupe;
create policy "monitor_alert_dedupe_select_own" on public.monitor_alert_dedupe
  for select using (auth.uid() = user_id);

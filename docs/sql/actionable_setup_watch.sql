-- Optional: persist developing actionable setups (WAIT_FOR_TRIGGER) for re-evaluation.
-- Run manually in Supabase SQL editor. Does not affect live /v1/setup scanner.

create table if not exists public.actionable_setup_watch (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  symbol text not null,
  strategy text,
  status text not null default 'WAIT_FOR_TRIGGER',
  reason text,
  next_action text,
  invalidation text,
  expires_rule text,
  data_feed text not null default 'sip',
  decision_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol, strategy)
);

create index if not exists actionable_setup_watch_symbol_idx
  on public.actionable_setup_watch (symbol);

alter table public.actionable_setup_watch enable row level security;

create policy "Users read own setup watches"
  on public.actionable_setup_watch for select
  using (auth.uid() = user_id);

create policy "Users upsert own setup watches"
  on public.actionable_setup_watch for all
  using (auth.uid() = user_id);

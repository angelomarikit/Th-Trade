-- Optional Supabase table for persisted actionable decision snapshots (run manually).
-- Does not enable live trading.

create table if not exists public.actionable_decisions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  evaluated_at timestamptz not null,
  market_regime text not null,
  final_action text not null,
  primary_strategy text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists actionable_decisions_symbol_time
  on public.actionable_decisions (symbol, evaluated_at desc);

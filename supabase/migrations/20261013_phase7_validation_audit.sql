-- Phase 7 — live validation evidence + immutable audit
-- Safe to re-run. Does not enable auto-trading.

alter table public.signal_performance_records
  add column if not exists validation_evidence jsonb,
  add column if not exists validated_by uuid references public.profiles (id) on delete set null,
  add column if not exists validated_at timestamptz;

create table if not exists public.signal_validation_audit (
  id bigserial primary key,
  signal_id text not null references public.signal_performance_records (id) on delete cascade,
  action text not null check (action in ('VALIDATE_ATTEMPT', 'VALIDATE_SUCCESS', 'VALIDATE_REJECT')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  evidence jsonb,
  errors jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists signal_validation_audit_signal_idx
  on public.signal_validation_audit (signal_id, created_at desc);

create index if not exists signal_validation_audit_actor_idx
  on public.signal_validation_audit (actor_user_id, created_at desc);

alter table public.signal_validation_audit enable row level security;

-- Append-only for authenticated users via service role; no update/delete policies for clients.
drop policy if exists "signal_validation_audit_select_own" on public.signal_validation_audit;
create policy "signal_validation_audit_select_own" on public.signal_validation_audit
  for select using (auth.uid() = actor_user_id);

comment on table public.signal_validation_audit is
  'Immutable audit of liveValidated attempts. Verified signal outcomes ≠ executed customer P/L.';

begin;

alter table public.wallets
  add column if not exists yellow_token numeric(14,2) not null default 0 check (yellow_token >= 0),
  add column if not exists red_token numeric(14,2) not null default 0 check (red_token >= 0),
  add column if not exists green_token numeric(14,2) not null default 0 check (green_token >= 0);

update public.wallets
set yellow_token = coalesce(nullif(yellow_token, 0), balance, 0)
where coalesce(balance, 0) > 0
  and coalesce(yellow_token, 0) = 0;

create table if not exists public.wallet_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  import_id uuid references public.energy_readings_import (id) on delete set null,
  yellow_delta numeric(14,2) not null default 0,
  red_delta numeric(14,2) not null default 0,
  green_delta numeric(14,2) not null default 0,
  source text not null default 'monthly_calculation',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, import_id, source)
);

create index if not exists wallet_audit_log_user_id_created_at_idx
  on public.wallet_audit_log (user_id, created_at desc);

drop trigger if exists wallet_audit_log_set_updated_at on public.wallet_audit_log;
create trigger wallet_audit_log_set_updated_at
before update on public.wallet_audit_log
for each row
execute function public.set_updated_at();

alter table public.wallet_audit_log enable row level security;

drop policy if exists "wallet_audit_log_owner_read" on public.wallet_audit_log;
create policy "wallet_audit_log_owner_read"
on public.wallet_audit_log for select
to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "wallet_audit_log_admin_manage" on public.wallet_audit_log;
create policy "wallet_audit_log_admin_manage"
on public.wallet_audit_log for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select on public.wallet_audit_log to authenticated;

commit;

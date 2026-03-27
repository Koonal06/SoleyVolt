begin;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'notifications_user_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      drop constraint notifications_user_id_fkey;
  end if;
end $$;

alter table public.notifications
  alter column user_id set not null;

alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists wallet_transactions_counterparty_user_id_idx
  on public.wallet_transactions (counterparty_user_id);

alter table public.energy_readings_import
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists processing_status text not null default 'pending',
  add column if not exists calculation_version text,
  add column if not exists net_kwh numeric(12,3),
  add column if not exists tokens_earned numeric(14,2),
  add column if not exists estimated_bill numeric(14,2),
  add column if not exists processing_error text,
  add column if not exists calculated_at timestamptz,
  add column if not exists promoted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'energy_readings_import_processing_status_check'
      and conrelid = 'public.energy_readings_import'::regclass
  ) then
    alter table public.energy_readings_import
      add constraint energy_readings_import_processing_status_check
      check (processing_status in ('pending', 'processing', 'calculated', 'promoted', 'failed'));
  end if;
end $$;

update public.energy_readings_import
set net_kwh = coalesce(exported_kwh, 0) - coalesce(imported_kwh, 0)
where net_kwh is null;

create index if not exists energy_readings_import_processing_status_idx
  on public.energy_readings_import (processing_status, billing_cycle desc);

create index if not exists energy_readings_import_meter_cycle_idx
  on public.energy_readings_import (meter_id, billing_cycle desc);

create table if not exists public.energy_calculations (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.energy_readings_import (id) on delete cascade,
  linked_user_id uuid references public.profiles (id) on delete set null,
  calculation_version text not null,
  net_kwh numeric(12,3) not null,
  tokens_earned numeric(14,2) not null default 0 check (tokens_earned >= 0),
  estimated_bill numeric(14,2),
  reward_tier text,
  result_payload jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (import_id, calculation_version)
);

create index if not exists energy_calculations_import_id_idx
  on public.energy_calculations (import_id, calculated_at desc);

create index if not exists energy_calculations_linked_user_id_idx
  on public.energy_calculations (linked_user_id, calculated_at desc);

alter table public.energy_calculations enable row level security;

drop policy if exists "energy_calculations_admin_manage" on public.energy_calculations;
create policy "energy_calculations_admin_manage"
on public.energy_calculations for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "energy_readings_import_admin_read" on public.energy_readings_import;
drop policy if exists "energy_readings_import_admin_write" on public.energy_readings_import;
drop policy if exists "energy_readings_import_admin_manage" on public.energy_readings_import;
create policy "energy_readings_import_admin_manage"
on public.energy_readings_import for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles for select
to authenticated
using (((select auth.uid()) = id) or (select public.is_admin()));

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles for update
to authenticated
using (((select auth.uid()) = id) or (select public.is_admin()))
with check (((select auth.uid()) = id) or (select public.is_admin()));

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert"
on public.profiles for insert
to authenticated
with check (((select auth.uid()) = id) or (select public.is_admin()));

drop policy if exists "user_settings_owner_all" on public.user_settings;
create policy "user_settings_owner_all"
on public.user_settings for all
to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()))
with check (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "wallets_owner_read" on public.wallets;
create policy "wallets_owner_read"
on public.wallets for select
to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "wallets_admin_update" on public.wallets;
create policy "wallets_admin_update"
on public.wallets for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "wallet_transactions_owner_read" on public.wallet_transactions;
create policy "wallet_transactions_owner_read"
on public.wallet_transactions for select
to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "wallet_transactions_insert_self_or_admin" on public.wallet_transactions;
create policy "wallet_transactions_insert_self_or_admin"
on public.wallet_transactions for insert
to authenticated
with check (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "energy_readings_owner_all" on public.energy_readings;
create policy "energy_readings_owner_all"
on public.energy_readings for all
to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()))
with check (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "notifications_owner_read" on public.notifications;
create policy "notifications_owner_read"
on public.notifications for select
to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "notifications_owner_update" on public.notifications;
create policy "notifications_owner_update"
on public.notifications for update
to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()))
with check (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert"
on public.notifications for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "green_coin_purchases_owner_read" on public.green_coin_purchases;
create policy "green_coin_purchases_owner_read"
on public.green_coin_purchases for select
to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "green_coin_purchases_owner_insert" on public.green_coin_purchases;
create policy "green_coin_purchases_owner_insert"
on public.green_coin_purchases for insert
to authenticated
with check (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists "green_coin_purchases_admin_update" on public.green_coin_purchases;
create policy "green_coin_purchases_admin_update"
on public.green_coin_purchases for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select on public.energy_readings_import to authenticated;
grant select on public.energy_calculations to authenticated;

commit;

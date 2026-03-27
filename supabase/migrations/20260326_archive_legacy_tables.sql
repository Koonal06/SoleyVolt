begin;

create schema if not exists archive;
revoke all on schema archive from public;
grant usage on schema archive to postgres, service_role;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users_legacy_20260326'
  ) then
    execute 'alter table public.users_legacy_20260326 set schema archive';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'meters_legacy_20260326'
  ) then
    execute 'alter table public.meters_legacy_20260326 set schema archive';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'transactions_legacy_20260326'
  ) then
    execute 'alter table public.transactions_legacy_20260326 set schema archive';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'wallets_legacy_20260326'
  ) then
    execute 'alter table public.wallets_legacy_20260326 set schema archive';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'energy_readings_legacy_20260326'
  ) then
    execute 'alter table public.energy_readings_legacy_20260326 set schema archive';
  end if;
end $$;

commit;

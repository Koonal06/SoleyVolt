begin;

create or replace function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = coalesce(target_user_id, auth.uid())
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users_legacy_20260326'
  ) then
    execute 'alter table public.users_legacy_20260326 disable row level security';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'meters_legacy_20260326'
  ) then
    execute 'alter table public.meters_legacy_20260326 disable row level security';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'transactions_legacy_20260326'
  ) then
    execute 'alter table public.transactions_legacy_20260326 disable row level security';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'wallets_legacy_20260326'
  ) then
    execute 'alter table public.wallets_legacy_20260326 disable row level security';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'energy_readings_legacy_20260326'
  ) then
    execute 'alter table public.energy_readings_legacy_20260326 disable row level security';
  end if;
end $$;

commit;

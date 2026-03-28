begin;

-- Repair migration for projects where auth/users-related tables exist
-- but public.profiles and dependent views are missing.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  language text not null default 'en',
  role text not null default 'user',
  user_type text not null default 'consumer',
  status text not null default 'active',
  avatar_url text,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_role_check check (role in ('user', 'admin', 'superadmin')),
  constraint profiles_user_type_check check (user_type in ('consumer', 'producer', 'prosumer')),
  constraint profiles_status_check check (status in ('active', 'inactive', 'suspended')),
  constraint profiles_email_not_blank check (btrim(email) <> ''),
  constraint profiles_full_name_not_blank check (full_name is null or btrim(full_name) <> ''),
  constraint profiles_language_format check (language ~ '^[a-z]{2}([_-][A-Za-z]{2})?$')
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_created_by_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_created_by_fkey
      foreign key (created_by) references public.profiles (id) on delete set null;
  end if;
end $$;

create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email));

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists profiles_status_idx
  on public.profiles (status);

create index if not exists profiles_created_by_idx
  on public.profiles (created_by);

insert into public.profiles (
  id,
  email,
  full_name,
  role,
  user_type,
  status,
  language,
  created_at,
  updated_at
)
select
  au.id,
  au.email,
  coalesce(
    nullif(btrim(au.raw_user_meta_data ->> 'full_name'), ''),
    split_part(au.email, '@', 1)
  ) as full_name,
  case
    when coalesce(au.raw_app_meta_data ->> 'role', '') in ('user', 'admin', 'superadmin') then au.raw_app_meta_data ->> 'role'
    when au.raw_app_meta_data ->> 'role' = 'super_admin' then 'superadmin'
    else 'user'
  end as role,
  case
    when coalesce(au.raw_app_meta_data ->> 'user_type', '') in ('consumer', 'producer', 'prosumer') then au.raw_app_meta_data ->> 'user_type'
    when coalesce(au.raw_user_meta_data ->> 'user_type', '') in ('consumer', 'producer', 'prosumer') then au.raw_user_meta_data ->> 'user_type'
    else 'consumer'
  end as user_type,
  case
    when coalesce(au.raw_app_meta_data ->> 'status', '') in ('active', 'inactive', 'suspended') then au.raw_app_meta_data ->> 'status'
    else 'active'
  end as status,
  lower(
    coalesce(
      nullif(btrim(au.raw_app_meta_data ->> 'language'), ''),
      nullif(btrim(au.raw_user_meta_data ->> 'language'), ''),
      'en'
    )
  ) as language,
  coalesce(au.created_at, timezone('utc', now())),
  timezone('utc', now())
from auth.users au
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = case
      when public.profiles.role = 'super_admin' then 'superadmin'
      else coalesce(nullif(public.profiles.role, ''), excluded.role)
    end,
    user_type = coalesce(nullif(public.profiles.user_type, ''), excluded.user_type),
    status = coalesce(nullif(public.profiles.status, ''), excluded.status),
    language = coalesce(nullif(public.profiles.language, ''), excluded.language),
    updated_at = timezone('utc', now());

update public.profiles
set role = 'superadmin'
where role = 'super_admin';

alter table public.profiles enable row level security;

create or replace function public.current_profile_role(target_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = coalesce(target_user_id, auth.uid())
$$;

create or replace function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = coalesce(target_user_id, auth.uid())
      and p.role in ('admin', 'superadmin')
      and p.status = 'active'
  );
$$;

create or replace function public.is_superadmin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = coalesce(target_user_id, auth.uid())
      and p.role = 'superadmin'
      and p.status = 'active'
  );
$$;

create or replace function public.is_super_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin(coalesce(target_user_id, auth.uid()));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := 'user';
  v_user_type text := 'consumer';
  v_status text := 'active';
  v_language text := 'en';
  v_created_by uuid := null;
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') in ('user', 'admin', 'superadmin') then
    v_role := new.raw_app_meta_data ->> 'role';
  elsif new.raw_app_meta_data ->> 'role' = 'super_admin' then
    v_role := 'superadmin';
  end if;

  if coalesce(new.raw_app_meta_data ->> 'user_type', '') in ('consumer', 'producer', 'prosumer') then
    v_user_type := new.raw_app_meta_data ->> 'user_type';
  elsif coalesce(new.raw_user_meta_data ->> 'user_type', '') in ('consumer', 'producer', 'prosumer') then
    v_user_type := new.raw_user_meta_data ->> 'user_type';
  end if;

  if coalesce(new.raw_app_meta_data ->> 'status', '') in ('active', 'inactive', 'suspended') then
    v_status := new.raw_app_meta_data ->> 'status';
  end if;

  if nullif(btrim(coalesce(new.raw_app_meta_data ->> 'language', '')), '') is not null then
    v_language := lower(btrim(new.raw_app_meta_data ->> 'language'));
  elsif nullif(btrim(coalesce(new.raw_user_meta_data ->> 'language', '')), '') is not null then
    v_language := lower(btrim(new.raw_user_meta_data ->> 'language'));
  end if;

  if coalesce(new.raw_app_meta_data ->> 'created_by', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_created_by := (new.raw_app_meta_data ->> 'created_by')::uuid;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    user_type,
    status,
    language,
    created_by
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    v_role,
    v_user_type,
    v_status,
    v_language,
    v_created_by
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      role = coalesce(nullif(public.profiles.role, ''), excluded.role),
      user_type = coalesce(nullif(public.profiles.user_type, ''), excluded.user_type),
      status = coalesce(nullif(public.profiles.status, ''), excluded.status),
      language = coalesce(nullif(public.profiles.language, ''), excluded.language),
      created_by = coalesce(public.profiles.created_by, excluded.created_by),
      updated_at = timezone('utc', now());

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_auth_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email,
        updated_at = timezone('utc', now())
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
execute function public.handle_auth_user_email_update();

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_role text := coalesce(auth.role(), '');
  v_actor_id uuid := auth.uid();
  v_actor_role text := public.current_profile_role(v_actor_id);
begin
  new.updated_at := timezone('utc', now());

  if v_request_role in ('service_role', 'supabase_admin') or v_request_role = '' then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profile id is immutable';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;

  if new.email is distinct from old.email then
    raise exception 'email must be updated through auth.users';
  end if;

  if v_actor_id is null or v_actor_role is null then
    raise exception 'authenticated profile required';
  end if;

  if v_actor_role = 'user' then
    if old.id <> v_actor_id then
      raise exception 'users may update only their own profile';
    end if;

    if new.role is distinct from old.role
       or new.user_type is distinct from old.user_type
       or new.status is distinct from old.status
       or new.created_by is distinct from old.created_by then
      raise exception 'users cannot modify restricted profile fields';
    end if;

    return new;
  end if;

  if v_actor_role = 'admin' then
    if old.role = 'superadmin' then
      raise exception 'admins cannot modify superadmin profiles';
    end if;

    if old.id = v_actor_id then
      if new.role <> 'admin' then
        raise exception 'admins cannot change their own role';
      end if;

      if new.user_type is distinct from old.user_type
         or new.status is distinct from old.status
         or new.created_by is distinct from old.created_by then
        raise exception 'admins cannot modify restricted fields on their own profile';
      end if;

      return new;
    end if;

    if old.role <> 'user' then
      raise exception 'admins may manage only normal user profiles';
    end if;

    if new.role <> 'user' then
      raise exception 'admins cannot assign admin or superadmin roles';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'admins cannot reassign created_by';
    end if;

    return new;
  end if;

  if v_actor_role = 'superadmin' then
    return new;
  end if;

  raise exception 'unsupported role';
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
before update on public.profiles
for each row
execute function public.guard_profile_update();

drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "profiles_self_insert" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin_scope" on public.profiles;
drop policy if exists "profiles_update_superadmin_all" on public.profiles;
drop policy if exists "profiles_delete_superadmin_only" on public.profiles;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles_select_admin_all"
on public.profiles for select
to authenticated
using ((select public.is_admin()));

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_update_admin_scope"
on public.profiles for update
to authenticated
using (
  (select public.is_admin())
  and (id = auth.uid() or role = 'user')
)
with check (
  (select public.is_admin())
  and (
    (id = auth.uid() and role = 'admin')
    or role = 'user'
  )
);

create policy "profiles_update_superadmin_all"
on public.profiles for update
to authenticated
using ((select public.is_superadmin()))
with check ((select public.is_superadmin()));

create policy "profiles_delete_superadmin_only"
on public.profiles for delete
to authenticated
using ((select public.is_superadmin()));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_user_id_fkey'
      and conrelid = 'public.user_settings'::regclass
  ) then
    alter table public.user_settings
      add constraint user_settings_user_id_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'wallets_user_id_fkey'
      and conrelid = 'public.wallets'::regclass
  ) then
    alter table public.wallets
      add constraint wallets_user_id_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_user_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_user_id_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'energy_readings_user_id_fkey'
      and conrelid = 'public.energy_readings'::regclass
  ) then
    alter table public.energy_readings
      add constraint energy_readings_user_id_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;
end $$;

create or replace view public.user_portal_summary
with (security_invoker = true) as
with settings as (
  select *
  from public.coin_settings
  where id = true
),
energy as (
  select
    er.user_id,
    coalesce(sum(er.imported_kwh), 0)::numeric(14,3) as total_imported_kwh,
    coalesce(sum(er.exported_kwh), 0)::numeric(14,3) as total_exported_kwh,
    coalesce(sum(er.tokens_earned), 0)::numeric(14,2) as yellow_coins
  from public.energy_readings er
  group by er.user_id
),
green as (
  select
    gp.user_id,
    coalesce(sum(gp.green_coins), 0)::numeric(14,2) as green_coins,
    coalesce(sum(gp.total_cost), 0)::numeric(14,2) as green_coin_total_cost
  from public.green_coin_purchases gp
  where gp.status = 'completed'
  group by gp.user_id
)
select
  p.id as user_id,
  p.full_name,
  p.language,
  p.role,
  p.user_type,
  p.status,
  coalesce(w.yellow_token, 0)::numeric(14,2)
    + coalesce(w.green_token, 0)::numeric(14,2)
    - coalesce(w.red_token, 0)::numeric(14,2) as balance,
  coalesce(w.lifetime_earned, 0)::numeric(14,2) as lifetime_earned,
  coalesce(w.lifetime_spent, 0)::numeric(14,2) as lifetime_spent,
  coalesce(e.total_imported_kwh, 0)::numeric(14,3) as total_imported_kwh,
  coalesce(e.total_exported_kwh, 0)::numeric(14,3) as total_exported_kwh,
  (coalesce(e.total_exported_kwh, 0) - coalesce(e.total_imported_kwh, 0))::numeric(14,3) as net_energy_kwh,
  round(coalesce(e.total_imported_kwh, 0) * s.red_coin_rate, 2)::numeric(14,2) as red_coins,
  coalesce(e.yellow_coins, 0)::numeric(14,2) as yellow_coins,
  coalesce(g.green_coins, 0)::numeric(14,2) as green_coins,
  coalesce(g.green_coin_total_cost, 0)::numeric(14,2) as green_coin_total_cost,
  greatest(
    round(
      (coalesce(e.total_imported_kwh, 0) * s.red_coin_rate)
      - coalesce(g.green_coins, 0) * s.green_coin_bill_offset_rate
      - coalesce(e.yellow_coins, 0) * s.yellow_coin_bill_offset_rate,
      2
    ),
    0
  )::numeric(14,2) as bill_estimate
from public.profiles p
join public.wallets w on w.user_id = p.id
cross join settings s
left join energy e on e.user_id = p.id
left join green g on g.user_id = p.id;

create or replace view public.user_wallet_summary
with (security_invoker = true) as
select
  ups.user_id,
  ups.full_name,
  ups.language,
  ups.role,
  ups.user_type,
  ups.status,
  ups.balance,
  ups.lifetime_earned,
  ups.lifetime_spent,
  ups.total_imported_kwh,
  ups.total_exported_kwh,
  ups.red_coins,
  ups.yellow_coins,
  ups.green_coins,
  ups.bill_estimate
from public.user_portal_summary ups;

create or replace view public.admin_overview
with (security_invoker = true) as
with active_users as (
  select *
  from public.user_portal_summary
  where status <> 'suspended'
)
select
  count(*)::bigint as total_users,
  coalesce(sum(balance), 0)::numeric(14,2) as total_tokens,
  coalesce(sum(total_imported_kwh), 0)::numeric(14,3) as total_imported_kwh,
  coalesce(sum(total_exported_kwh), 0)::numeric(14,3) as total_exported_kwh,
  coalesce(sum(red_coins), 0)::numeric(14,2) as total_red_coins,
  coalesce(sum(yellow_coins), 0)::numeric(14,2) as total_yellow_coins,
  coalesce(sum(green_coins), 0)::numeric(14,2) as total_green_coins
from active_users;

create or replace view public.public_user_directory
with (security_invoker = true) as
select
  id,
  coalesce(nullif(full_name, ''), split_part(id::text, '-', 1)) as full_name,
  avatar_url
from public.profiles
where status = 'active';

grant select on public.profiles to authenticated;
grant select on public.user_portal_summary to authenticated;
grant select on public.user_wallet_summary to authenticated;
grant select on public.admin_overview to authenticated;
grant select on public.public_user_directory to authenticated;

commit;

begin;

-- -------------------------------------------------------------------
-- SoleyVolt controlled onboarding and hierarchical RBAC hardening
-- Hierarchy: superadmin -> admin -> user
-- -------------------------------------------------------------------

-- -------------------------------------------------------------------
-- 1. Bring the profiles schema to the required shape
-- -------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

create index if not exists profiles_created_by_idx
  on public.profiles (created_by);

update public.profiles as p
set email = au.email
from auth.users as au
where au.id = p.id
  and p.email is distinct from au.email;

update public.profiles
set role = 'superadmin'
where role = 'super_admin';

update public.profiles
set role = coalesce(nullif(trim(role), ''), 'user'),
    user_type = coalesce(nullif(trim(user_type), ''), 'consumer'),
    status = coalesce(nullif(trim(status), ''), 'active'),
    language = coalesce(nullif(trim(language), ''), 'en'),
    updated_at = timezone('utc', now());

alter table public.profiles
  alter column email set not null,
  alter column role set default 'user',
  alter column user_type set default 'consumer',
  alter column status set default 'active',
  alter column language set default 'en',
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set default timezone('utc', now());

alter table public.profiles
  drop constraint if exists profiles_role_check,
  drop constraint if exists profiles_status_check,
  drop constraint if exists profiles_language_check,
  drop constraint if exists profiles_user_type_check,
  drop constraint if exists profiles_email_not_blank,
  drop constraint if exists profiles_full_name_not_blank,
  drop constraint if exists profiles_language_format;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('user', 'admin', 'superadmin')),
  add constraint profiles_user_type_check
    check (user_type in ('consumer', 'producer', 'prosumer')),
  add constraint profiles_status_check
    check (status in ('active', 'inactive', 'suspended')),
  add constraint profiles_email_not_blank
    check (btrim(email) <> ''),
  add constraint profiles_full_name_not_blank
    check (full_name is null or btrim(full_name) <> ''),
  add constraint profiles_language_format
    check (language ~ '^[a-z]{2}([_-][A-Za-z]{2})?$');

create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email));

comment on table public.profiles is 'Application profile and authorization data for SoleyVolt users.';
comment on column public.profiles.role is 'Access role: user, admin, or superadmin.';
comment on column public.profiles.user_type is 'Energy behavior type for normal users.';
comment on column public.profiles.created_by is 'Admin/superadmin who created the account, when available.';

-- -------------------------------------------------------------------
-- 2. Role helper functions
--    Authorization decisions read from public.profiles, not client input.
-- -------------------------------------------------------------------
drop function if exists public.current_profile_role();
drop function if exists public.current_profile_role(uuid);
create function public.current_profile_role(target_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = coalesce(target_user_id, auth.uid())
$$;

drop function if exists public.is_admin();
drop function if exists public.is_admin(uuid);
create function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = coalesce(target_user_id, auth.uid())
      and p.role in ('admin', 'superadmin')
      and p.status = 'active'
  );
$$;

drop function if exists public.is_superadmin();
drop function if exists public.is_superadmin(uuid);
create function public.is_superadmin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = coalesce(target_user_id, auth.uid())
      and p.role = 'superadmin'
      and p.status = 'active'
  );
$$;

drop function if exists public.is_super_admin();
drop function if exists public.is_super_admin(uuid);
create function public.is_super_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin(coalesce(target_user_id, auth.uid()));
$$;

revoke all on function public.current_profile_role(uuid) from public;
revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_superadmin(uuid) from public;
revoke all on function public.is_super_admin(uuid) from public;

grant execute on function public.current_profile_role(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_superadmin(uuid) to authenticated;
grant execute on function public.is_super_admin(uuid) to authenticated;

-- -------------------------------------------------------------------
-- 3. Profile creation / sync trigger from auth.users
--    Sensitive defaults come from raw_app_meta_data, which should only
--    be set by trusted server-side onboarding flows.
-- -------------------------------------------------------------------
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
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    v_role,
    v_user_type,
    v_status,
    v_language,
    v_created_by
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        role = coalesce(public.profiles.role, excluded.role),
        user_type = coalesce(public.profiles.user_type, excluded.user_type),
        status = coalesce(public.profiles.status, excluded.status),
        language = coalesce(public.profiles.language, excluded.language),
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

-- -------------------------------------------------------------------
-- 4. Update guard to prevent privilege escalation on public.profiles
--    Service-role requests are allowed because trusted backend code
--    performs its own higher-level authorization checks before writing.
-- -------------------------------------------------------------------
drop trigger if exists profiles_guard_update on public.profiles;
drop trigger if exists before_profile_update_guard on public.profiles;

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

create trigger profiles_guard_update
before update on public.profiles
for each row
execute function public.guard_profile_update();

-- -------------------------------------------------------------------
-- 5. RLS for public.profiles
-- -------------------------------------------------------------------
alter table public.profiles enable row level security;

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

commit;

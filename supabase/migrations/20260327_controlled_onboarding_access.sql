begin;

alter table public.profiles
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

create index if not exists profiles_created_by_idx
  on public.profiles (created_by);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      drop constraint profiles_role_check;
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('user', 'admin', 'super_admin'));
end $$;

create or replace function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = coalesce(target_user_id, auth.uid())
      and role in ('admin', 'super_admin')
      and status = 'active'
  );
$$;

create or replace function public.is_super_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = coalesce(target_user_id, auth.uid())
      and role = 'super_admin'
      and status = 'active'
  );
$$;

commit;

begin;

create extension if not exists "pgcrypto";

create or replace function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = coalesce(target_user_id, auth.uid())
      and role = 'admin'
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  language text not null default 'en' check (language in ('en', 'fr', 'cr')),
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_notifications boolean not null default true,
  push_notifications boolean not null default false,
  transaction_alerts boolean not null default true,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  lifetime_earned numeric(14,2) not null default 0 check (lifetime_earned >= 0),
  lifetime_spent numeric(14,2) not null default 0 check (lifetime_spent >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  counterparty_user_id uuid references public.profiles (id) on delete set null,
  transaction_type text not null check (transaction_type in ('earn', 'send', 'receive', 'adjustment')),
  amount numeric(14,2) not null,
  description text not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists wallet_transactions_user_id_created_at_idx
  on public.wallet_transactions (user_id, created_at desc);

create table if not exists public.energy_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reading_date date not null,
  imported_kwh numeric(12,3) not null default 0 check (imported_kwh >= 0),
  exported_kwh numeric(12,3) not null default 0 check (exported_kwh >= 0),
  tokens_earned numeric(14,2) not null default 0 check (tokens_earned >= 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, reading_date)
);

create index if not exists energy_readings_user_id_date_idx
  on public.energy_readings (user_id, reading_date desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null check (notification_type in ('info', 'success', 'warning', 'error')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.transfer_tokens(receiver_id uuid, transfer_amount numeric, transfer_description text default null)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_id uuid := auth.uid();
  sender_wallet public.wallets%rowtype;
  receiver_wallet public.wallets%rowtype;
  sender_tx public.wallet_transactions%rowtype;
  clean_description text;
begin
  if sender_id is null then
    raise exception 'Authentication required';
  end if;

  if receiver_id is null or receiver_id = sender_id then
    raise exception 'Invalid receiver';
  end if;

  if transfer_amount is null or transfer_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;

  clean_description := coalesce(nullif(trim(transfer_description), ''), 'Peer transfer');

  select * into sender_wallet
  from public.wallets
  where user_id = sender_id
  for update;

  select * into receiver_wallet
  from public.wallets
  where user_id = receiver_id
  for update;

  if sender_wallet.user_id is null or receiver_wallet.user_id is null then
    raise exception 'Wallet not found';
  end if;

  if sender_wallet.balance < transfer_amount then
    raise exception 'Insufficient balance';
  end if;

  update public.wallets
  set balance = balance - transfer_amount,
      lifetime_spent = lifetime_spent + transfer_amount
  where user_id = sender_id;

  update public.wallets
  set balance = balance + transfer_amount,
      lifetime_earned = lifetime_earned + transfer_amount
  where user_id = receiver_id;

  insert into public.wallet_transactions (
    user_id,
    counterparty_user_id,
    transaction_type,
    amount,
    description,
    status
  )
  values (
    sender_id,
    receiver_id,
    'send',
    -transfer_amount,
    clean_description,
    'completed'
  )
  returning * into sender_tx;

  insert into public.wallet_transactions (
    user_id,
    counterparty_user_id,
    transaction_type,
    amount,
    description,
    status
  )
  values (
    receiver_id,
    sender_id,
    'receive',
    transfer_amount,
    clean_description,
    'completed'
  );

  return sender_tx;
end;
$$;

create or replace function public.record_energy_reading(target_date date, imported numeric, exported numeric, notes_input text default null)
returns public.energy_readings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  net_export numeric := greatest(coalesce(exported, 0) - coalesce(imported, 0), 0);
  earned_tokens numeric := round(net_export * 0.5, 2);
  reading public.energy_readings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.energy_readings (
    user_id,
    reading_date,
    imported_kwh,
    exported_kwh,
    tokens_earned,
    notes
  )
  values (
    current_user_id,
    coalesce(target_date, current_date),
    greatest(coalesce(imported, 0), 0),
    greatest(coalesce(exported, 0), 0),
    earned_tokens,
    notes_input
  )
  on conflict (user_id, reading_date)
  do update
  set imported_kwh = excluded.imported_kwh,
      exported_kwh = excluded.exported_kwh,
      tokens_earned = excluded.tokens_earned,
      notes = excluded.notes
  returning * into reading;

  update public.wallets
  set balance = balance + earned_tokens,
      lifetime_earned = lifetime_earned + earned_tokens
  where user_id = current_user_id;

  insert into public.wallet_transactions (
    user_id,
    transaction_type,
    amount,
    description,
    status,
    metadata
  )
  values (
    current_user_id,
    'earn',
    earned_tokens,
    'Solar production reward',
    'completed',
    jsonb_build_object('reading_date', reading.reading_date)
  );

  return reading;
end;
$$;

create or replace view public.user_wallet_summary as
select
  p.id as user_id,
  p.full_name,
  p.language,
  p.role,
  p.status,
  w.balance,
  w.lifetime_earned,
  w.lifetime_spent,
  coalesce((
    select sum(imported_kwh)
    from public.energy_readings er
    where er.user_id = p.id
  ), 0) as total_imported_kwh,
  coalesce((
    select sum(exported_kwh)
    from public.energy_readings er
    where er.user_id = p.id
  ), 0) as total_exported_kwh
from public.profiles p
join public.wallets w on w.user_id = p.id;

create or replace view public.admin_overview as
select
  count(*)::bigint as total_users,
  coalesce(sum(w.balance), 0)::numeric(14,2) as total_tokens,
  coalesce(sum(er.imported_kwh), 0)::numeric(14,3) as total_imported_kwh,
  coalesce(sum(er.exported_kwh), 0)::numeric(14,3) as total_exported_kwh
from public.profiles p
left join public.wallets w on w.user_id = p.id
left join public.energy_readings er on er.user_id = p.id
where p.status <> 'suspended';

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.energy_readings enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles for select
to authenticated
using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles for update
to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert"
on public.profiles for insert
to authenticated
with check (auth.uid() = id or public.is_admin());

drop policy if exists "user_settings_owner_all" on public.user_settings;
create policy "user_settings_owner_all"
on public.user_settings for all
to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "wallets_owner_read" on public.wallets;
create policy "wallets_owner_read"
on public.wallets for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "wallets_admin_update" on public.wallets;
create policy "wallets_admin_update"
on public.wallets for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "wallet_transactions_owner_read" on public.wallet_transactions;
create policy "wallet_transactions_owner_read"
on public.wallet_transactions for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "wallet_transactions_insert_self_or_admin" on public.wallet_transactions;
create policy "wallet_transactions_insert_self_or_admin"
on public.wallet_transactions for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "energy_readings_owner_all" on public.energy_readings;
create policy "energy_readings_owner_all"
on public.energy_readings for all
to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "notifications_owner_read" on public.notifications;
create policy "notifications_owner_read"
on public.notifications for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "notifications_owner_update" on public.notifications;
create policy "notifications_owner_update"
on public.notifications for update
to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert"
on public.notifications for insert
to authenticated
with check (public.is_admin());

grant usage on schema public to anon, authenticated, service_role;
grant select on public.user_wallet_summary to authenticated;
grant select on public.admin_overview to authenticated;
grant execute on function public.transfer_tokens(uuid, numeric, text) to authenticated;
grant execute on function public.record_energy_reading(date, numeric, numeric, text) to authenticated;

commit;

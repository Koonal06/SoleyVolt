begin;

create extension if not exists "pgcrypto";

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'users'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'users_legacy_20260326'
  ) then
    execute 'alter table public.users rename to users_legacy_20260326';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'meters'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'meters_legacy_20260326'
  ) then
    execute 'alter table public.meters rename to meters_legacy_20260326';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'transactions'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'transactions_legacy_20260326'
  ) then
    execute 'alter table public.transactions rename to transactions_legacy_20260326';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'wallets'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'wallets_legacy_20260326'
  ) then
    execute 'alter table public.wallets rename to wallets_legacy_20260326';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'energy_readings'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'energy_readings_legacy_20260326'
  ) then
    execute 'alter table public.energy_readings rename to energy_readings_legacy_20260326';
  end if;
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
      and role = 'admin'
      and status = 'active'
  );
$$;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('user', 'admin'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('active', 'inactive', 'suspended'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_language_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_language_check
      check (language in ('en', 'fr', 'cr'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_type_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_type_check
      check (user_type in ('consumer', 'producer', 'prosumer'));
  end if;
end $$;

alter table public.profiles
  alter column role set default 'user',
  alter column status set default 'active',
  alter column language set default 'en',
  alter column user_type set default 'prosumer';

update public.profiles
set role = coalesce(nullif(role, ''), 'user'),
    status = coalesce(nullif(status, ''), 'active'),
    language = coalesce(nullif(language, ''), 'en'),
    user_type = coalesce(nullif(user_type, ''), 'prosumer'),
    updated_at = coalesce(updated_at, timezone('utc', now()));

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

create table if not exists public.coin_settings (
  id boolean primary key default true check (id = true),
  red_coin_rate numeric(14,4) not null default 0.8 check (red_coin_rate >= 0),
  yellow_coin_rate numeric(14,4) not null default 0.5 check (yellow_coin_rate >= 0),
  yellow_coin_bill_offset_rate numeric(14,4) not null default 0.2 check (yellow_coin_bill_offset_rate >= 0),
  green_coin_unit_price numeric(14,4) not null default 1.25 check (green_coin_unit_price >= 0),
  green_coin_bill_offset_rate numeric(14,4) not null default 1 check (green_coin_bill_offset_rate >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.coin_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.green_coin_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  green_coins numeric(14,2) not null check (green_coins > 0),
  unit_price numeric(14,4) not null check (unit_price >= 0),
  total_cost numeric(14,2) not null check (total_cost >= 0),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  payment_reference text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists green_coin_purchases_user_id_created_at_idx
  on public.green_coin_purchases (user_id, created_at desc);

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

drop trigger if exists coin_settings_set_updated_at on public.coin_settings;
create trigger coin_settings_set_updated_at
before update on public.coin_settings
for each row
execute function public.set_updated_at();

insert into public.profiles (id, email, full_name, role, status, user_type, language)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'full_name', split_part(au.email, '@', 1)),
  'user',
  'active',
  coalesce(au.raw_user_meta_data ->> 'user_type', 'prosumer'),
  'en'
from auth.users au
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    user_type = coalesce(public.profiles.user_type, excluded.user_type),
    updated_at = timezone('utc', now());

insert into public.user_settings (user_id)
select p.id
from public.profiles p
on conflict (user_id) do nothing;

insert into public.wallets (user_id)
select p.id
from public.profiles p
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, user_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'user_type', 'prosumer')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      user_type = coalesce(public.profiles.user_type, excluded.user_type),
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

  select *
  into sender_wallet
  from public.wallets
  where user_id = sender_id
  for update;

  select *
  into receiver_wallet
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

create or replace function public.purchase_green_coins(purchase_amount numeric, payment_reference_input text default null)
returns public.green_coin_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_row public.coin_settings%rowtype;
  purchase public.green_coin_purchases%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if purchase_amount is null or purchase_amount <= 0 then
    raise exception 'Purchase amount must be greater than zero';
  end if;

  select *
  into settings_row
  from public.coin_settings
  where id = true;

  insert into public.green_coin_purchases (
    user_id,
    green_coins,
    unit_price,
    total_cost,
    status,
    payment_reference
  )
  values (
    current_user_id,
    round(purchase_amount, 2),
    settings_row.green_coin_unit_price,
    round(purchase_amount * settings_row.green_coin_unit_price, 2),
    'completed',
    nullif(trim(payment_reference_input), '')
  )
  returning * into purchase;

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
    'adjustment',
    0,
    'Green Coin purchase',
    'completed',
    jsonb_build_object('green_coin_purchase_id', purchase.id, 'green_coins', purchase.green_coins)
  );

  return purchase;
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
  settings_row public.coin_settings%rowtype;
  net_export numeric := greatest(coalesce(exported, 0) - coalesce(imported, 0), 0);
  earned_tokens numeric;
  previous_tokens numeric := 0;
  token_delta numeric;
  reading public.energy_readings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into settings_row
  from public.coin_settings
  where id = true;

  earned_tokens := round(net_export * settings_row.yellow_coin_rate, 2);

  select tokens_earned
  into previous_tokens
  from public.energy_readings
  where user_id = current_user_id
    and reading_date = coalesce(target_date, current_date);

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

  token_delta := earned_tokens - coalesce(previous_tokens, 0);

  update public.wallets
  set balance = balance + token_delta,
      lifetime_earned = lifetime_earned + greatest(token_delta, 0),
      lifetime_spent = lifetime_spent + abs(least(token_delta, 0))
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
    token_delta,
    'Solar production reward',
    'completed',
    jsonb_build_object('reading_date', reading.reading_date)
  );

  return reading;
end;
$$;

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
  w.balance,
  w.lifetime_earned,
  w.lifetime_spent,
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

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.energy_readings enable row level security;
alter table public.notifications enable row level security;
alter table public.coin_settings enable row level security;
alter table public.green_coin_purchases enable row level security;

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

drop policy if exists "coin_settings_read_authenticated" on public.coin_settings;
create policy "coin_settings_read_authenticated"
on public.coin_settings for select
to authenticated
using (true);

drop policy if exists "coin_settings_admin_update" on public.coin_settings;
create policy "coin_settings_admin_update"
on public.coin_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "green_coin_purchases_owner_read" on public.green_coin_purchases;
create policy "green_coin_purchases_owner_read"
on public.green_coin_purchases for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "green_coin_purchases_owner_insert" on public.green_coin_purchases;
create policy "green_coin_purchases_owner_insert"
on public.green_coin_purchases for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "green_coin_purchases_admin_update" on public.green_coin_purchases;
create policy "green_coin_purchases_admin_update"
on public.green_coin_purchases for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to anon, authenticated, service_role;
grant select on public.user_portal_summary to authenticated;
grant select on public.user_wallet_summary to authenticated;
grant select on public.admin_overview to authenticated;
grant select on public.public_user_directory to authenticated;
grant select on public.coin_settings to authenticated;
grant select on public.green_coin_purchases to authenticated;
grant execute on function public.transfer_tokens(uuid, numeric, text) to authenticated;
grant execute on function public.record_energy_reading(date, numeric, numeric, text) to authenticated;
grant execute on function public.purchase_green_coins(numeric, text) to authenticated;

commit;

begin;

alter table public.profiles
  add column if not exists user_type text not null default 'prosumer'
  check (user_type in ('consumer', 'producer', 'prosumer'));

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

drop trigger if exists coin_settings_set_updated_at on public.coin_settings;
create trigger coin_settings_set_updated_at
before update on public.coin_settings
for each row
execute function public.set_updated_at();

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

alter table public.coin_settings enable row level security;
alter table public.green_coin_purchases enable row level security;

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

  select * into settings_row
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

  select * into settings_row
  from public.coin_settings
  where id = true;

  earned_tokens := round(net_export * settings_row.yellow_coin_rate, 2);

  select tokens_earned into previous_tokens
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

create or replace view public.user_portal_summary as
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

create or replace view public.user_wallet_summary as
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

create or replace view public.admin_overview as
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

grant select on public.user_portal_summary to authenticated;
grant select on public.green_coin_purchases to authenticated;
grant select on public.coin_settings to authenticated;
grant execute on function public.purchase_green_coins(numeric, text) to authenticated;

commit;

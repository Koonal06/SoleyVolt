begin;

create or replace function public.green_coin_live_multiplier(target_ts timestamptz default now())
returns numeric
language sql
stable
set search_path = public
as $$
  with market_clock as (
    select
      (
        extract(hour from timezone('Indian/Mauritius', target_ts)) * 60
        + extract(minute from timezone('Indian/Mauritius', target_ts))
        + extract(second from timezone('Indian/Mauritius', target_ts)) / 60.0
      )::numeric as minutes_of_day
  )
  select round(
    greatest(
      0.82,
      least(
        1.18,
        1
        + 0.12 * cos(((minutes_of_day - 1260) / 1440.0) * 2 * pi())
        + 0.015 * sin((minutes_of_day / 360.0) * 2 * pi())
      )
    )::numeric,
    6
  )
  from market_clock;
$$;

create or replace function public.green_coin_live_price(target_ts timestamptz default now())
returns numeric
language sql
stable
set search_path = public
as $$
  select round(s.green_coin_unit_price * public.green_coin_live_multiplier(target_ts), 2)
  from public.coin_settings s
  where s.id = true;
$$;

create or replace function public.purchase_green_coins(purchase_amount numeric, payment_reference_input text default null)
returns public.green_coin_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  live_unit_price numeric(14,2);
  purchase public.green_coin_purchases%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if purchase_amount is null or purchase_amount <= 0 then
    raise exception 'Purchase amount must be greater than zero';
  end if;

  live_unit_price := public.green_coin_live_price(now());

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
    live_unit_price,
    round(purchase_amount * live_unit_price, 2),
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
    format('Purchased %s Green Coins', round(purchase_amount, 2)),
    'completed',
    jsonb_build_object(
      'purchase_id', purchase.id,
      'green_coins', purchase.green_coins,
      'unit_price', purchase.unit_price,
      'total_cost', purchase.total_cost
    )
  );

  return purchase;
end;
$$;

drop policy if exists "coin_settings_read_authenticated" on public.coin_settings;
drop policy if exists "coin_settings_read_public" on public.coin_settings;
create policy "coin_settings_read_public"
on public.coin_settings for select
to anon, authenticated
using (true);

grant select on public.coin_settings to anon, authenticated;
grant execute on function public.green_coin_live_multiplier(timestamptz) to anon, authenticated;
grant execute on function public.green_coin_live_price(timestamptz) to anon, authenticated;
grant execute on function public.purchase_green_coins(numeric, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.coin_settings;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;

commit;

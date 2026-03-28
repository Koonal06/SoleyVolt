begin;

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

grant select on public.user_portal_summary to authenticated;
grant select on public.user_wallet_summary to authenticated;
grant select on public.admin_overview to authenticated;
grant select on public.public_user_directory to authenticated;

commit;

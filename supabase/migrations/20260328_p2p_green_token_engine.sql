begin;

create or replace function public.ensure_wallet_exists(target_user_id uuid)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_row public.wallets%rowtype;
begin
  if target_user_id is null then
    raise exception 'user_id is required';
  end if;

  insert into public.wallets (
    user_id,
    balance,
    lifetime_earned,
    lifetime_spent,
    yellow_token,
    red_token,
    green_token
  )
  values (
    target_user_id,
    0,
    0,
    0,
    0,
    0,
    0
  )
  on conflict (user_id) do nothing;

  select *
  into wallet_row
  from public.wallets
  where user_id = target_user_id;

  return wallet_row;
end;
$$;

create or replace function public.purchase_green_tokens_p2p(
  seller_id uuid,
  amount_rs numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer_id uuid := auth.uid();
  month_start timestamptz := date_trunc('month', timezone('utc', now()));
  next_month_start timestamptz := month_start + interval '1 month';
  rounded_amount_rs numeric(14,2);
  yellow_amount numeric(14,2);
  green_tokens_received numeric(14,2);
  buyer_cap numeric(14,2);
  existing_purchases numeric(14,2);
  total_after_purchase numeric(14,2);
  buyer_meter_id text;
  buyer_wallet public.wallets%rowtype;
  seller_wallet public.wallets%rowtype;
  updated_buyer_wallet public.wallets%rowtype;
  updated_seller_wallet public.wallets%rowtype;
  purchase_row public.green_coin_purchases%rowtype;
  sender_tx public.wallet_transactions%rowtype;
  receiver_tx public.wallet_transactions%rowtype;
  transfer_group_id uuid := gen_random_uuid();
  metadata jsonb;
begin
  if buyer_id is null then
    raise exception 'Authentication required';
  end if;

  if seller_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'seller_id is required'
    );
  end if;

  if seller_id = buyer_id then
    return jsonb_build_object(
      'success', false,
      'error', 'buyer_id and seller_id must be different'
    );
  end if;

  rounded_amount_rs := round(coalesce(amount_rs, 0), 2);
  if rounded_amount_rs <= 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'amount_rs must be greater than 0'
    );
  end if;

  if not exists (select 1 from public.profiles where id = buyer_id) then
    return jsonb_build_object(
      'success', false,
      'error', 'Buyer not found',
      'buyer_id', buyer_id
    );
  end if;

  if not exists (select 1 from public.profiles where id = seller_id) then
    return jsonb_build_object(
      'success', false,
      'error', 'Seller not found',
      'seller_id', seller_id
    );
  end if;

  yellow_amount := rounded_amount_rs;
  green_tokens_received := round(rounded_amount_rs / 2.0, 2);

  select eri.meter_id
  into buyer_meter_id
  from public.energy_readings_import eri
  where eri.linked_user_id = buyer_id
    and eri.meter_id is not null
  order by eri.billing_cycle desc nulls last, eri.created_at desc
  limit 1;

  if buyer_meter_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Buyer meter not found',
      'buyer_id', buyer_id
    );
  end if;

  select coalesce(round(avg(recent_imports.imported_kwh) / 2.0, 2), 0)
  into buyer_cap
  from (
    select eri.imported_kwh
    from public.energy_readings_import eri
    where eri.linked_user_id = buyer_id
      and eri.meter_id = buyer_meter_id
      and eri.imported_kwh is not null
    order by eri.billing_cycle desc nulls last, eri.created_at desc
    limit 3
  ) as recent_imports;

  select coalesce(round(sum(gp.green_coins), 2), 0)
  into existing_purchases
  from public.green_coin_purchases gp
  where gp.user_id = buyer_id
    and gp.status = 'completed'
    and gp.created_at >= month_start
    and gp.created_at < next_month_start;

  total_after_purchase := round(existing_purchases + green_tokens_received, 2);

  if total_after_purchase > buyer_cap then
    return jsonb_build_object(
      'success', false,
      'error', 'Purchase exceeds green cap',
      'cap_limit', buyer_cap,
      'existing_purchases', existing_purchases,
      'requested', green_tokens_received,
      'available', greatest(round(buyer_cap - existing_purchases, 2), 0)
    );
  end if;

  buyer_wallet := public.ensure_wallet_exists(buyer_id);
  seller_wallet := public.ensure_wallet_exists(seller_id);

  select *
  into buyer_wallet
  from public.wallets
  where user_id = buyer_id
  for update;

  select *
  into seller_wallet
  from public.wallets
  where user_id = seller_id
  for update;

  if coalesce(seller_wallet.yellow_token, 0) < yellow_amount then
    return jsonb_build_object(
      'success', false,
      'error', 'Seller has insufficient yellow balance',
      'seller_id', seller_id,
      'yellow_required', yellow_amount,
      'yellow_available', coalesce(seller_wallet.yellow_token, 0)
    );
  end if;

  update public.wallets
  set yellow_token = round(coalesce(yellow_token, 0) - yellow_amount, 2),
      balance = round(greatest(coalesce(yellow_token, 0) - yellow_amount + coalesce(green_token, 0) - coalesce(red_token, 0), 0), 2),
      lifetime_spent = round(coalesce(lifetime_spent, 0) + yellow_amount, 2),
      updated_at = timezone('utc', now())
  where user_id = seller_id
  returning * into updated_seller_wallet;

  update public.wallets
  set green_token = round(coalesce(green_token, 0) + green_tokens_received, 2),
      balance = round(greatest(coalesce(yellow_token, 0) + coalesce(green_token, 0) + green_tokens_received - coalesce(red_token, 0), 0), 2),
      lifetime_earned = round(coalesce(lifetime_earned, 0) + green_tokens_received, 2),
      updated_at = timezone('utc', now())
  where user_id = buyer_id
  returning * into updated_buyer_wallet;

  insert into public.green_coin_purchases (
    user_id,
    green_coins,
    unit_price,
    total_cost,
    status,
    payment_reference
  )
  values (
    buyer_id,
    green_tokens_received,
    round(rounded_amount_rs / nullif(green_tokens_received, 0), 2),
    rounded_amount_rs,
    'completed',
    null
  )
  returning * into purchase_row;

  metadata := jsonb_build_object(
    'token_type', 'green_purchase',
    'amount', green_tokens_received,
    'amount_rs', rounded_amount_rs,
    'yellow_deducted_from_seller', yellow_amount,
    'green_added_to_buyer', green_tokens_received,
    'transfer_group_id', transfer_group_id,
    'sender_id', seller_id,
    'receiver_id', buyer_id,
    'purchase_id', purchase_row.id,
    'month', to_char(month_start, 'YYYY-MM')
  );

  insert into public.wallet_transactions (
    user_id,
    counterparty_user_id,
    transaction_type,
    amount,
    description,
    status,
    metadata
  )
  values (
    seller_id,
    buyer_id,
    'send',
    green_tokens_received * -1,
    'Peer green token purchase',
    'completed',
    metadata
  )
  returning * into sender_tx;

  insert into public.wallet_transactions (
    user_id,
    counterparty_user_id,
    transaction_type,
    amount,
    description,
    status,
    metadata
  )
  values (
    buyer_id,
    seller_id,
    'receive',
    green_tokens_received,
    'Peer green token purchase',
    'completed',
    metadata
  )
  returning * into receiver_tx;

  return jsonb_build_object(
    'success', true,
    'buyer_id', buyer_id,
    'seller_id', seller_id,
    'amount_rs', rounded_amount_rs,
    'yellow_deducted_from_seller', yellow_amount,
    'green_added_to_buyer', green_tokens_received,
    'buyer_balances', jsonb_build_object(
      'user_id', updated_buyer_wallet.user_id,
      'yellow_token', coalesce(updated_buyer_wallet.yellow_token, 0),
      'red_token', coalesce(updated_buyer_wallet.red_token, 0),
      'green_token', coalesce(updated_buyer_wallet.green_token, 0),
      'yellow_balance', coalesce(updated_buyer_wallet.yellow_token, 0),
      'red_balance', coalesce(updated_buyer_wallet.red_token, 0),
      'green_balance', coalesce(updated_buyer_wallet.green_token, 0),
      'balance', coalesce(updated_buyer_wallet.balance, 0),
      'updated_at', updated_buyer_wallet.updated_at
    ),
    'seller_balances', jsonb_build_object(
      'user_id', updated_seller_wallet.user_id,
      'yellow_token', coalesce(updated_seller_wallet.yellow_token, 0),
      'red_token', coalesce(updated_seller_wallet.red_token, 0),
      'green_token', coalesce(updated_seller_wallet.green_token, 0),
      'yellow_balance', coalesce(updated_seller_wallet.yellow_token, 0),
      'red_balance', coalesce(updated_seller_wallet.red_token, 0),
      'green_balance', coalesce(updated_seller_wallet.green_token, 0),
      'balance', coalesce(updated_seller_wallet.balance, 0),
      'updated_at', updated_seller_wallet.updated_at
    ),
    'transaction_record', jsonb_build_object(
      'sender_record', to_jsonb(sender_tx),
      'receiver_record', to_jsonb(receiver_tx)
    ),
    'green_purchase_record', jsonb_build_object(
      'id', purchase_row.id,
      'user_id', purchase_row.user_id,
      'month', to_char(month_start, 'YYYY-MM'),
      'green_purchased', purchase_row.green_coins,
      'kwh_covered', purchase_row.green_coins,
      'amount_rs', purchase_row.total_cost,
      'unit_price', purchase_row.unit_price,
      'status', purchase_row.status,
      'created_at', purchase_row.created_at
    ),
    'cap_status', jsonb_build_object(
      'limit', buyer_cap,
      'existing', existing_purchases,
      'requested', green_tokens_received,
      'remaining', greatest(round(buyer_cap - total_after_purchase, 2), 0)
    )
  );
end;
$$;

create or replace function public.process_end_of_month_settlement(
  target_user_id uuid default auth.uid(),
  settlement_month date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  resolved_user_id uuid := coalesce(target_user_id, requester_id);
  month_start date := date_trunc('month', coalesce(settlement_month, timezone('utc', now())::date))::date;
  current_wallet public.wallets%rowtype;
  updated_wallet public.wallets%rowtype;
  red_before numeric(14,2);
  green_before numeric(14,2);
  green_to_use numeric(14,2);
  settlement_tx public.wallet_transactions%rowtype;
  metadata jsonb;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if resolved_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'user_id is required'
    );
  end if;

  if requester_id <> resolved_user_id and not public.is_admin(requester_id) then
    raise exception 'Admin access required';
  end if;

  if not exists (select 1 from public.profiles where id = resolved_user_id) then
    return jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', resolved_user_id
    );
  end if;

  current_wallet := public.ensure_wallet_exists(resolved_user_id);

  select *
  into current_wallet
  from public.wallets
  where user_id = resolved_user_id
  for update;

  red_before := round(coalesce(current_wallet.red_token, 0), 2);
  green_before := round(coalesce(current_wallet.green_token, 0), 2);

  if red_before <= 0 or green_before <= 0 then
    return jsonb_build_object(
      'success', true,
      'user_id', resolved_user_id,
      'month', to_char(month_start, 'YYYY-MM'),
      'green_used', 0,
      'red_before', red_before,
      'red_after', red_before,
      'green_before', green_before,
      'green_after', green_before,
      'settlement_record', null,
      'message', 'No settlement needed'
    );
  end if;

  green_to_use := round(least(green_before, red_before), 2);

  update public.wallets
  set red_token = round(coalesce(red_token, 0) - green_to_use, 2),
      green_token = round(coalesce(green_token, 0) - green_to_use, 2),
      balance = round(greatest(coalesce(yellow_token, 0) + coalesce(green_token, 0) - green_to_use - (coalesce(red_token, 0) - green_to_use), 0), 2),
      lifetime_spent = round(coalesce(lifetime_spent, 0) + green_to_use, 2),
      updated_at = timezone('utc', now())
  where user_id = resolved_user_id
  returning * into updated_wallet;

  metadata := jsonb_build_object(
    'token_type', 'monthly_settlement',
    'amount', green_to_use,
    'amount_rs', round(green_to_use * 2, 2),
    'sender_id', resolved_user_id,
    'receiver_id', null,
    'month', to_char(month_start, 'YYYY-MM')
  );

  insert into public.wallet_transactions (
    user_id,
    counterparty_user_id,
    transaction_type,
    amount,
    description,
    status,
    metadata
  )
  values (
    resolved_user_id,
    null,
    'adjustment',
    green_to_use * -1,
    'Automatic monthly settlement',
    'completed',
    metadata
  )
  returning * into settlement_tx;

  return jsonb_build_object(
    'success', true,
    'user_id', resolved_user_id,
    'month', to_char(month_start, 'YYYY-MM'),
    'green_used', green_to_use,
    'red_before', red_before,
    'red_after', round(coalesce(updated_wallet.red_token, 0), 2),
    'green_before', green_before,
    'green_after', round(coalesce(updated_wallet.green_token, 0), 2),
    'settlement_record', to_jsonb(settlement_tx)
  );
end;
$$;

create or replace function public.process_all_users_end_of_month(
  settlement_month date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  month_start date := date_trunc('month', coalesce(settlement_month, timezone('utc', now())::date))::date;
  user_row record;
  result jsonb;
  results jsonb := '[]'::jsonb;
  errors jsonb := '[]'::jsonb;
  total_users_processed integer := 0;
  total_green_used numeric(14,2) := 0;
  total_red_remaining numeric(14,2) := 0;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin(requester_id) then
    raise exception 'Admin access required';
  end if;

  for user_row in
    select p.id
    from public.profiles p
    order by p.created_at asc, p.id asc
  loop
    result := public.process_end_of_month_settlement(user_row.id, month_start);
    results := results || jsonb_build_array(result);

    if coalesce((result ->> 'success')::boolean, false) then
      total_users_processed := total_users_processed + 1;
      total_green_used := round(total_green_used + coalesce((result ->> 'green_used')::numeric, 0), 2);
      total_red_remaining := round(total_red_remaining + coalesce((result ->> 'red_after')::numeric, 0), 2);
    else
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'user_id', user_row.id,
          'error', coalesce(result ->> 'error', 'Unknown error')
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'success', jsonb_array_length(errors) = 0,
    'month', to_char(month_start, 'YYYY-MM'),
    'total_users_processed', total_users_processed,
    'total_green_used_across_all_users', total_green_used,
    'total_red_remaining_across_all_users', total_red_remaining,
    'results', results,
    'errors', errors
  );
end;
$$;

create or replace function public.get_user_transaction_history(
  target_user_id uuid default auth.uid(),
  filter_token_type text default null,
  limit_count integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  resolved_user_id uuid := coalesce(target_user_id, requester_id);
  safe_limit integer := greatest(1, least(coalesce(limit_count, 50), 100));
  history_rows jsonb := '[]'::jsonb;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if resolved_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'user_id is required'
    );
  end if;

  if requester_id <> resolved_user_id and not public.is_admin(requester_id) then
    raise exception 'Admin access required';
  end if;

  if not exists (select 1 from public.profiles where id = resolved_user_id) then
    return jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', resolved_user_id
    );
  end if;

  with normalized as (
    select
      wt.id,
      wt.user_id,
      wt.counterparty_user_id,
      wt.transaction_type,
      wt.amount,
      wt.description,
      wt.status,
      wt.created_at,
      wt.metadata,
      coalesce(
        wt.metadata ->> 'sender_id',
        case
          when wt.transaction_type = 'send' then wt.user_id::text
          when wt.transaction_type = 'receive' then wt.counterparty_user_id::text
          else wt.user_id::text
        end
      ) as sender_id_text,
      coalesce(
        wt.metadata ->> 'receiver_id',
        case
          when wt.transaction_type = 'send' then wt.counterparty_user_id::text
          when wt.transaction_type = 'receive' then wt.user_id::text
          else wt.counterparty_user_id::text
        end
      ) as receiver_id_text,
      coalesce(wt.metadata ->> 'token_type', wt.transaction_type) as normalized_token_type,
      coalesce((wt.metadata ->> 'amount')::numeric, abs(wt.amount)) as normalized_amount,
      coalesce((wt.metadata ->> 'amount_rs')::numeric, 0) as normalized_amount_rs,
      coalesce(
        wt.metadata ->> 'transfer_group_id',
        concat_ws(
          '|',
          coalesce(wt.metadata ->> 'token_type', wt.transaction_type),
          coalesce(wt.metadata ->> 'sender_id', ''),
          coalesce(wt.metadata ->> 'receiver_id', ''),
          coalesce(wt.created_at::text, ''),
          abs(wt.amount)::text
        )
      ) as event_key,
      case when wt.user_id = resolved_user_id then 0 else 1 end as preference_rank
    from public.wallet_transactions wt
    where wt.user_id = resolved_user_id
       or wt.counterparty_user_id = resolved_user_id
  ),
  filtered as (
    select *
    from normalized
    where filter_token_type is null or normalized_token_type = filter_token_type
  ),
  deduped as (
    select *,
           row_number() over (
             partition by event_key
             order by preference_rank asc, created_at desc, id asc
           ) as row_num
    from filtered
  ),
  final_rows as (
    select *
    from deduped
    where row_num = 1
    order by created_at desc
    limit safe_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', fr.id,
        'sender_id', nullif(fr.sender_id_text, '')::uuid,
        'receiver_id', nullif(fr.receiver_id_text, '')::uuid,
        'token_type', fr.normalized_token_type,
        'amount', fr.normalized_amount,
        'amount_rs', fr.normalized_amount_rs,
        'description', fr.description,
        'status', fr.status,
        'created_at', fr.created_at,
        'direction',
          case
            when nullif(fr.receiver_id_text, '') is null then 'system'
            when nullif(fr.sender_id_text, '')::uuid = resolved_user_id then 'sent'
            when nullif(fr.receiver_id_text, '')::uuid = resolved_user_id then 'received'
            else 'system'
          end,
        'note',
          case
            when nullif(fr.receiver_id_text, '') is null then 'Automatic monthly settlement applied green tokens to red debt.'
            else null
          end
      )
      order by fr.created_at desc
    ),
    '[]'::jsonb
  )
  into history_rows
  from final_rows fr;

  return jsonb_build_object(
    'success', true,
    'user_id', resolved_user_id,
    'total_transactions', jsonb_array_length(history_rows),
    'transactions', history_rows
  );
end;
$$;

grant execute on function public.purchase_green_tokens_p2p(uuid, numeric) to authenticated;
grant execute on function public.process_end_of_month_settlement(uuid, date) to authenticated;
grant execute on function public.process_all_users_end_of_month(date) to authenticated;
grant execute on function public.get_user_transaction_history(uuid, text, integer) to authenticated;

commit;

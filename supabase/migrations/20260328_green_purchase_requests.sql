begin;

create table if not exists public.green_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  amount_rs numeric(10,2) not null check (amount_rs > 0),
  yellow_amount numeric(10,2) not null check (yellow_amount > 0),
  green_amount numeric(10,2) not null check (green_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz,
  notes text,
  constraint green_purchase_requests_buyer_seller_check check (buyer_id <> seller_id)
);

comment on table public.green_purchase_requests is
  'Tracks peer-to-peer green token purchase requests before a seller accepts or rejects them.';

comment on column public.green_purchase_requests.buyer_id is
  'Profile id of the buyer requesting green tokens.';

comment on column public.green_purchase_requests.seller_id is
  'Profile id of the seller expected to provide yellow tokens for the green exchange.';

comment on column public.green_purchase_requests.amount_rs is
  'Requested spend amount in rupees for the off-chain P2P transaction.';

comment on column public.green_purchase_requests.yellow_amount is
  'Yellow token amount the seller must give up. Equal to amount_rs because 1 yellow = Rs 1.';

comment on column public.green_purchase_requests.green_amount is
  'Green token amount the buyer should receive. Equal to amount_rs / 2 because 1 green = Rs 2.';

comment on column public.green_purchase_requests.status is
  'Current workflow state of the purchase request.';

comment on column public.green_purchase_requests.notes is
  'Optional notes such as rejection reasons or workflow comments.';

create index if not exists idx_green_purchase_requests_buyer_id
  on public.green_purchase_requests (buyer_id);

create index if not exists idx_green_purchase_requests_seller_id
  on public.green_purchase_requests (seller_id);

create index if not exists idx_green_purchase_requests_status
  on public.green_purchase_requests (status);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.green_purchase_requests;
create trigger set_updated_at
before update on public.green_purchase_requests
for each row
execute function public.update_updated_at_column();

alter table public.green_purchase_requests enable row level security;

drop policy if exists "green_purchase_requests_read_participants" on public.green_purchase_requests;
create policy "green_purchase_requests_read_participants"
on public.green_purchase_requests for select
to authenticated
using (
  (select auth.uid()) = buyer_id
  or (select auth.uid()) = seller_id
  or (select public.is_admin())
);

drop policy if exists "green_purchase_requests_insert_buyer" on public.green_purchase_requests;
create policy "green_purchase_requests_insert_buyer"
on public.green_purchase_requests for insert
to authenticated
with check (
  (select auth.uid()) = buyer_id
  or (select public.is_admin())
);

drop policy if exists "green_purchase_requests_update_participants" on public.green_purchase_requests;
create policy "green_purchase_requests_update_participants"
on public.green_purchase_requests for update
to authenticated
using (
  (select auth.uid()) = buyer_id
  or (select auth.uid()) = seller_id
  or (select public.is_admin())
)
with check (
  (select auth.uid()) = buyer_id
  or (select auth.uid()) = seller_id
  or (select public.is_admin())
);

grant select, insert, update on public.green_purchase_requests to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'green_purchase_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.green_purchase_requests';
  end if;
end;
$$;

commit;

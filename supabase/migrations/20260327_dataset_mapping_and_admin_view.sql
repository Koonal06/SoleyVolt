begin;

create table if not exists public.dataset_user_mappings (
  dataset_user_code text primary key,
  dataset_user_type text not null check (dataset_user_type in ('consumer', 'producer', 'prosumer')),
  linked_user_id uuid not null references public.profiles (id) on delete cascade,
  source_file_name text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists dataset_user_mappings_linked_user_idx
  on public.dataset_user_mappings (linked_user_id);

drop trigger if exists dataset_user_mappings_set_updated_at on public.dataset_user_mappings;
create trigger dataset_user_mappings_set_updated_at
before update on public.dataset_user_mappings
for each row
execute function public.set_updated_at();

alter table public.dataset_user_mappings enable row level security;

drop policy if exists "dataset_user_mappings_admin_manage" on public.dataset_user_mappings;
create policy "dataset_user_mappings_admin_manage"
on public.dataset_user_mappings for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace function public.apply_dataset_user_mapping(
  dataset_code text,
  profile_id uuid,
  dataset_type text default null,
  source_file text default null,
  mapping_notes text default null
)
returns public.dataset_user_mappings
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_type text;
  mapping_row public.dataset_user_mappings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select coalesce(
    dataset_type,
    (
      select eri.dataset_user_type
      from public.energy_readings_import eri
      where eri.dataset_user_code = dataset_code
      order by eri.created_at desc
      limit 1
    )
  )
  into resolved_type;

  if resolved_type is null then
    raise exception 'Unable to resolve dataset user type for %', dataset_code;
  end if;

  insert into public.dataset_user_mappings (
    dataset_user_code,
    dataset_user_type,
    linked_user_id,
    source_file_name,
    notes
  )
  values (
    dataset_code,
    resolved_type,
    profile_id,
    source_file,
    mapping_notes
  )
  on conflict (dataset_user_code)
  do update
  set dataset_user_type = excluded.dataset_user_type,
      linked_user_id = excluded.linked_user_id,
      source_file_name = coalesce(excluded.source_file_name, public.dataset_user_mappings.source_file_name),
      notes = excluded.notes,
      updated_at = timezone('utc', now())
  returning * into mapping_row;

  update public.energy_readings_import
  set linked_user_id = profile_id
  where dataset_user_code = dataset_code;

  update public.energy_calculations ec
  set linked_user_id = profile_id
  from public.energy_readings_import eri
  where ec.import_id = eri.id
    and eri.dataset_user_code = dataset_code;

  return mapping_row;
end;
$$;

create or replace view public.energy_import_admin_view
with (security_invoker = true) as
select
  eri.id,
  eri.source_file_name,
  eri.dataset_user_code,
  eri.dataset_user_type,
  eri.meter_id,
  eri.billing_cycle,
  eri.reading_date,
  eri.period_start,
  eri.period_end,
  eri.imported_kwh,
  eri.exported_kwh,
  eri.net_kwh,
  eri.tokens_earned,
  eri.yellow_tokens,
  eri.red_tokens,
  eri.green_cap_kwh,
  eri.green_purchased_kwh,
  eri.remaining_green_cap_kwh,
  eri.settlement_required_kwh,
  eri.estimated_bill,
  eri.processing_status,
  eri.calculation_version,
  eri.processing_error,
  eri.calculated_at,
  eri.promoted_at,
  eri.linked_user_id,
  p.full_name as linked_user_name,
  p.email as linked_user_email
from public.energy_readings_import eri
left join public.profiles p on p.id = eri.linked_user_id;

grant select on public.energy_import_admin_view to authenticated;
grant select on public.dataset_user_mappings to authenticated;
grant execute on function public.apply_dataset_user_mapping(text, uuid, text, text, text) to authenticated;

commit;

begin;

create table if not exists public.energy_readings_import (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  dataset_user_code text not null,
  dataset_user_type text not null check (dataset_user_type in ('consumer', 'producer', 'prosumer')),
  meter_id text not null,
  billing_cycle integer not null check (billing_cycle > 0),
  reading_date date,
  imported_kwh numeric(12,3) not null default 0 check (imported_kwh >= 0),
  exported_kwh numeric(12,3) not null default 0 check (exported_kwh >= 0),
  linked_user_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (source_file_name, dataset_user_code, meter_id, billing_cycle)
);

create index if not exists energy_readings_import_dataset_user_cycle_idx
  on public.energy_readings_import (dataset_user_code, billing_cycle desc);

create index if not exists energy_readings_import_linked_user_idx
  on public.energy_readings_import (linked_user_id, billing_cycle desc);

alter table public.energy_readings_import enable row level security;

drop policy if exists "energy_readings_import_admin_read" on public.energy_readings_import;
create policy "energy_readings_import_admin_read"
on public.energy_readings_import for select
using (public.is_admin());

drop policy if exists "energy_readings_import_admin_write" on public.energy_readings_import;
create policy "energy_readings_import_admin_write"
on public.energy_readings_import for all
using (public.is_admin())
with check (public.is_admin());

insert into public.energy_readings_import (
  source_file_name,
  dataset_user_code,
  dataset_user_type,
  meter_id,
  billing_cycle,
  imported_kwh,
  exported_kwh,
  notes
)
values
  ('8. sustainx_final_dataset (1).xlsx', 'PR001', 'prosumer', 'M001', 1, 5.0, 25.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR002', 'prosumer', 'M002', 1, 6.0, 28.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR003', 'prosumer', 'M003', 1, 4.0, 22.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR004', 'prosumer', 'M004', 1, 3.0, 20.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR005', 'prosumer', 'M005', 1, 5.0, 30.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C001', 'consumer', 'M006', 1, 30.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C002', 'consumer', 'M007', 1, 35.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C003', 'consumer', 'M008', 1, 28.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C004', 'consumer', 'M009', 1, 40.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C005', 'consumer', 'M010', 1, 32.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR006', 'prosumer', 'M011', 1, 10.0, 15.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR007', 'prosumer', 'M012', 1, 18.0, 12.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR008', 'prosumer', 'M013', 1, 12.0, 14.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR009', 'prosumer', 'M014', 1, 20.0, 10.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR010', 'prosumer', 'M015', 1, 15.0, 16.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR001', 'prosumer', 'M001', 2, 6.0, 27.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR002', 'prosumer', 'M002', 2, 5.0, 30.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR003', 'prosumer', 'M003', 2, 4.0, 24.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR004', 'prosumer', 'M004', 2, 3.0, 22.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR005', 'prosumer', 'M005', 2, 6.0, 32.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C001', 'consumer', 'M006', 2, 32.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C002', 'consumer', 'M007', 2, 36.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C003', 'consumer', 'M008', 2, 30.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C004', 'consumer', 'M009', 2, 42.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'C005', 'consumer', 'M010', 2, 34.0, 0.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR006', 'prosumer', 'M011', 2, 11.0, 16.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR007', 'prosumer', 'M012', 2, 20.0, 13.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR008', 'prosumer', 'M013', 2, 13.0, 15.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR009', 'prosumer', 'M014', 2, 22.0, 11.0, 'Imported from SustainX dataset'),
  ('8. sustainx_final_dataset (1).xlsx', 'PR010', 'prosumer', 'M015', 2, 16.0, 18.0, 'Imported from SustainX dataset')
on conflict (source_file_name, dataset_user_code, meter_id, billing_cycle) do update
set dataset_user_type = excluded.dataset_user_type,
    imported_kwh = excluded.imported_kwh,
    exported_kwh = excluded.exported_kwh,
    notes = excluded.notes;

commit;

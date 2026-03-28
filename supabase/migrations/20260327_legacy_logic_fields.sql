begin;

alter table public.energy_readings_import
  add column if not exists yellow_tokens numeric(14,2),
  add column if not exists red_tokens numeric(14,2),
  add column if not exists green_cap_kwh numeric(14,3),
  add column if not exists green_purchased_kwh numeric(14,3),
  add column if not exists remaining_green_cap_kwh numeric(14,3),
  add column if not exists settlement_required_kwh numeric(14,3);

alter table public.energy_calculations
  add column if not exists yellow_tokens numeric(14,2),
  add column if not exists red_tokens numeric(14,2),
  add column if not exists green_cap_kwh numeric(14,3),
  add column if not exists green_purchased_kwh numeric(14,3),
  add column if not exists remaining_green_cap_kwh numeric(14,3),
  add column if not exists settlement_required_kwh numeric(14,3),
  add column if not exists logic_name text not null default 'ceb_legacy_port';

comment on table public.energy_calculations is
  'Versioned monthly energy calculation outputs, including legacy CEB-style yellow/red/green token logic.';

commit;

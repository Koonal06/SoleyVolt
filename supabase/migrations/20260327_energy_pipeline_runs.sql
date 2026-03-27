begin;

create table if not exists public.energy_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'manual',
  status text not null check (status in ('running', 'completed', 'completed_with_errors', 'failed', 'skipped')),
  calculation_version text not null,
  rows_considered integer not null default 0,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  promoted_count integer not null default 0,
  statuses_filter text[] not null default '{}'::text[],
  promote boolean not null default false,
  dry_run boolean not null default false,
  anchor_date date,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists energy_pipeline_runs_started_at_idx
  on public.energy_pipeline_runs (started_at desc);

alter table public.energy_pipeline_runs enable row level security;

drop policy if exists "energy_pipeline_runs_admin_read" on public.energy_pipeline_runs;
create policy "energy_pipeline_runs_admin_read"
on public.energy_pipeline_runs for select
to authenticated
using ((select public.is_admin()));

grant select on public.energy_pipeline_runs to authenticated;

commit;

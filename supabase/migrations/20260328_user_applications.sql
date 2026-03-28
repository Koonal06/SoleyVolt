create table if not exists public.user_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) >= 2),
  nic text not null check (nic ~ '^[A-Z0-9]{14}$'),
  email text not null check (position('@' in email) > 1),
  phone text not null check (char_length(trim(phone)) >= 7),
  address text not null check (char_length(trim(address)) >= 5),
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'fr', 'cr')),
  requested_user_type text not null default 'prosumer'
    check (requested_user_type in ('consumer', 'producer', 'prosumer')),
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'under_review', 'approved', 'rejected')),
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  linked_profile_id uuid references public.profiles (id) on delete set null
);

create unique index if not exists user_applications_pending_email_idx
  on public.user_applications (lower(email))
  where status in ('pending', 'under_review');

create unique index if not exists user_applications_pending_nic_idx
  on public.user_applications (lower(nic))
  where status in ('pending', 'under_review');

create index if not exists user_applications_status_idx
  on public.user_applications (status, submitted_at desc);

create index if not exists user_applications_reviewed_by_idx
  on public.user_applications (reviewed_by);

create index if not exists user_applications_linked_profile_idx
  on public.user_applications (linked_profile_id);

create table if not exists public.user_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.user_applications (id) on delete cascade,
  action text not null
    check (action in ('submitted', 'under_review', 'approved', 'rejected', 'account_created', 'note')),
  from_status text
    check (from_status is null or from_status in ('pending', 'under_review', 'approved', 'rejected')),
  to_status text
    check (to_status is null or to_status in ('pending', 'under_review', 'approved', 'rejected')),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_application_events_application_idx
  on public.user_application_events (application_id, created_at desc);

alter table public.user_applications enable row level security;
alter table public.user_application_events enable row level security;

drop policy if exists "user_applications_no_direct_access" on public.user_applications;
create policy "user_applications_no_direct_access"
on public.user_applications for all
using (false)
with check (false);

drop policy if exists "user_application_events_no_direct_access" on public.user_application_events;
create policy "user_application_events_no_direct_access"
on public.user_application_events for all
using (false)
with check (false);

insert into public.user_application_events (
  application_id,
  action,
  to_status,
  notes,
  actor_email
)
select
  ua.id,
  'submitted',
  ua.status,
  'Application imported into audit trail.',
  ua.email
from public.user_applications ua
where not exists (
  select 1
  from public.user_application_events uae
  where uae.application_id = ua.id
);

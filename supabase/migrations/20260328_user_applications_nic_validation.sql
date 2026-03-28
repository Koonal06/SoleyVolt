update public.user_applications
set nic = upper(regexp_replace(nic, '[^A-Za-z0-9]', '', 'g'))
where nic is not null;

alter table public.user_applications
  drop constraint if exists user_applications_nic_check;

alter table public.user_applications
  add constraint user_applications_nic_check
  check (nic ~ '^[A-Z0-9]{14}$');

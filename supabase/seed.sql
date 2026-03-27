-- Optional seed helpers for local/manual setup.
-- Run this only after you have at least one signed-up user in auth.users.

update public.profiles
set role = 'admin',
    user_type = 'prosumer',
    full_name = coalesce(full_name, 'Admin User')
where id = '00000000-0000-0000-0000-000000000000';

insert into public.notifications (user_id, notification_type, title, message)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'info',
    'Welcome to SoleyVolt',
    'Your account is ready. Start recording energy production and transferring SLT.'
  )
on conflict do nothing;

-- Replace the placeholder UUID above with a real auth.users id before running.

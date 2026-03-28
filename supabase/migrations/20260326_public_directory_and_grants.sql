begin;

create or replace view public.public_user_directory as
select
  id,
  coalesce(nullif(full_name, ''), split_part(id::text, '-', 1)) as full_name,
  avatar_url,
  email
from public.profiles
where status = 'active';

grant select on public.public_user_directory to authenticated;

commit;

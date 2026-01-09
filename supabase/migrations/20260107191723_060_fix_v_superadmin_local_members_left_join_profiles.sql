drop view if exists public.v_superadmin_local_members;

create view public.v_superadmin_local_members as
select
  lm.id as membership_id,
  lm.org_id,
  lm.local_id,
  l.name as local_name,
  lm.user_id,
  coalesce(p.email, '') as email,
  lm.role,
  lm.status,
  lm.is_primary,
  lm.created_at
from public.local_memberships lm
join public.locals l on l.id = lm.local_id
left join public.profiles p on p.user_id = lm.user_id
where public.rls_is_superadmin();

-- Verification (manual):
-- select * from public.local_memberships where local_id = '<local_id>';
-- select * from public.v_superadmin_local_members where local_id = '<local_id>';

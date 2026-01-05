create or replace view v_my_locals as
-- memberships activas del usuario autenticado
select
  lm.local_id,
  l.name as local_name,
  lm.org_id,
  lm.role::text as membership_role,
  lm.status::text as membership_status
from local_memberships lm
join locals l on l.id = lm.local_id
where lm.user_id = auth.uid()
  and lm.status = 'active';

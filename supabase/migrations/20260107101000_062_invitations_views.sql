create or replace view public.v_org_invitations as
select
  i.id as invitation_id,
  i.email,
  i.org_id,
  i.local_id,
  l.name as local_name,
  i.invited_role as role,
  i.status,
  i.sent_at,
  i.expires_at
from public.invitations i
left join public.locals l on l.id = i.local_id
where public.rls_is_superadmin()
  or public.rls_is_org_admin(i.org_id);

create or replace view public.v_invitation_public as
select
  i.id as invitation_id,
  o.name as org_name,
  l.name as local_name,
  i.invited_role as role,
  i.expires_at
from public.invitations i
join public.organizations o on o.id = i.org_id
left join public.locals l on l.id = i.local_id
where i.status = 'pending'
  and now() < i.expires_at;

create or replace view public.v_org_local_context as
select
  o.id as org_id,
  o.name as org_name,
  case
    when o.archived_at is null then 'active'
    else 'archived'
  end as org_status,
  l.id as local_id,
  l.name as local_name,
  case
    when l.archived_at is null then 'active'
    else 'archived'
  end as local_status
from public.locals l
join public.organizations o on o.id = l.org_id
where public.rls_is_superadmin()
  or public.rls_is_org_admin(l.org_id);

-- Sanity checks (manual)
-- select * from public.v_org_invitations limit 10;
-- select * from public.v_invitation_public limit 1;
-- select * from public.v_org_local_context limit 5;

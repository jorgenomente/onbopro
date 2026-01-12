create or replace view public.v_org_invitations_context as
with org_access as (
  select o.id as org_id, o.name as org_name
  from public.organizations o
  where public.rls_is_superadmin()
     or public.rls_is_org_admin(o.id)
),
invitations as (
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
  join org_access oa on oa.org_id = i.org_id
),
invitations_json as (
  select
    i.org_id,
    jsonb_agg(
      jsonb_build_object(
        'invitation_id', i.invitation_id,
        'email', i.email,
        'org_id', i.org_id,
        'local_id', i.local_id,
        'local_name', i.local_name,
        'role', i.role,
        'status', i.status,
        'sent_at', i.sent_at,
        'expires_at', i.expires_at
      )
      order by i.sent_at desc nulls last
    ) as invitations
  from invitations i
  group by i.org_id
),
locals_base as (
  select
    l.id as local_id,
    l.org_id,
    l.name,
    case
      when l.archived_at is null then 'active'
      else 'archived'
    end as status
  from public.locals l
  join org_access oa on oa.org_id = l.org_id
),
locals_json as (
  select
    lb.org_id,
    jsonb_agg(
      jsonb_build_object(
        'local_id', lb.local_id,
        'org_id', lb.org_id,
        'name', lb.name,
        'status', lb.status
      )
      order by lb.name
    ) as org_locals
  from locals_base lb
  group by lb.org_id
)
select
  oa.org_id,
  oa.org_name,
  coalesce(ij.invitations, '[]'::jsonb) as invitations,
  coalesce(lj.org_locals, '[]'::jsonb) as org_locals
from org_access oa
left join invitations_json ij on ij.org_id = oa.org_id
left join locals_json lj on lj.org_id = oa.org_id;

-- Sanity checks (manual)
-- select * from public.v_org_invitations_context limit 5;

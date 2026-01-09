drop view if exists public.v_superadmin_organization_detail;

create view public.v_superadmin_organization_detail as
with orgs as (
  select
    o.id as org_id,
    o.name,
    case
      when o.archived_at is null then 'active'
      else 'archived'
    end as status,
    o.created_at
  from public.organizations o
  where public.rls_is_superadmin()
),
locals_base as (
  select
    l.org_id,
    l.id as local_id,
    l.name,
    case
      when l.archived_at is null then 'active'
      else 'archived'
    end as status
  from public.locals l
),
locals_counts as (
  select
    lm.local_id,
    count(*)::int as learners_count
  from public.local_memberships lm
  where lm.role = 'aprendiz'
    and lm.status = 'active'
  group by lm.local_id
),
locals_json as (
  select
    lb.org_id,
    jsonb_agg(
      jsonb_build_object(
        'local_id', lb.local_id,
        'name', lb.name,
        'learners_count', coalesce(lc.learners_count, 0),
        'status', lb.status
      )
      order by lb.name
    ) as locals
  from locals_base lb
  left join locals_counts lc on lc.local_id = lb.local_id
  group by lb.org_id
),
admins_json as (
  select
    oa.org_id,
    jsonb_agg(
      jsonb_build_object(
        'membership_id', oa.membership_id,
        'user_id', oa.user_id,
        'email', oa.email,
        'full_name', oa.full_name,
        'status', oa.status
      )
      order by oa.email
    ) as admins
  from public.v_superadmin_org_admins oa
  group by oa.org_id
),
admin_invitations_json as (
  select
    oi.org_id,
    jsonb_agg(
      jsonb_build_object(
        'invitation_id', oi.invitation_id,
        'email', oi.email,
        'invited_role', oi.invited_role,
        'status', oi.status,
        'sent_at', oi.sent_at,
        'expires_at', oi.expires_at,
        'accepted_at', oi.accepted_at,
        'created_at', oi.created_at
      )
      order by oi.created_at desc
    ) as admin_invitations
  from public.v_superadmin_org_admin_invitations oi
  group by oi.org_id
),
courses_json as (
  select
    c.org_id,
    jsonb_agg(
      jsonb_build_object(
        'course_id', c.id,
        'title', c.title,
        'status', c.status
      )
      order by c.created_at desc
    ) as courses
  from public.courses c
  group by c.org_id
)
select
  o.org_id,
  o.name,
  o.status,
  o.created_at,
  coalesce(lj.locals, '[]'::jsonb) as locals,
  coalesce(aj.admins, '[]'::jsonb) as admins,
  coalesce(aij.admin_invitations, '[]'::jsonb) as admin_invitations,
  coalesce(cj.courses, '[]'::jsonb) as courses
from orgs o
left join locals_json lj on lj.org_id = o.org_id
left join admins_json aj on aj.org_id = o.org_id
left join admin_invitations_json aij on aij.org_id = o.org_id
left join courses_json cj on cj.org_id = o.org_id;

-- Verification (manual):
-- select * from public.v_superadmin_organization_detail where org_id = '<org_id>';

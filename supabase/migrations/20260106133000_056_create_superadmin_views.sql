create or replace view public.v_superadmin_organizations as
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
locals_count as (
  select l.org_id, count(*)::int as locals_count
  from public.locals l
  group by l.org_id
),
users_count as (
  select om.org_id, count(distinct om.user_id)::int as users_count
  from public.org_memberships om
  where om.status = 'active'
  group by om.org_id
)
select
  o.org_id,
  o.name,
  o.status,
  coalesce(lc.locals_count, 0) as locals_count,
  coalesce(uc.users_count, 0) as users_count,
  o.created_at
from orgs o
left join locals_count lc on lc.org_id = o.org_id
left join users_count uc on uc.org_id = o.org_id
order by o.created_at desc;

create or replace view public.v_superadmin_organization_detail as
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
    om.org_id,
    jsonb_agg(
      jsonb_build_object(
        'user_id', om.user_id,
        'email', p.email,
        'status', om.status
      )
      order by p.email
    ) as admins
  from public.org_memberships om
  join public.profiles p on p.user_id = om.user_id
  where om.role = 'org_admin'
  group by om.org_id
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
  coalesce(cj.courses, '[]'::jsonb) as courses
from orgs o
left join locals_json lj on lj.org_id = o.org_id
left join admins_json aj on aj.org_id = o.org_id
left join courses_json cj on cj.org_id = o.org_id;

-- Sanity queries (dev)
-- select * from public.v_superadmin_organizations limit 10;
-- select * from public.v_superadmin_organization_detail where org_id = '...';

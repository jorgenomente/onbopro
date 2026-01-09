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
        'membership_id', om.id,
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

create or replace view public.v_superadmin_local_members as
select
  lm.id as membership_id,
  lm.org_id,
  lm.local_id,
  l.name as local_name,
  lm.user_id,
  p.email,
  lm.role,
  lm.status,
  lm.is_primary,
  lm.created_at
from public.local_memberships lm
join public.locals l on l.id = lm.local_id
join public.profiles p on p.user_id = lm.user_id
where public.rls_is_superadmin();

create or replace view public.v_superadmin_local_context as
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
where public.rls_is_superadmin();

create or replace view public.v_org_courses as
with org_access as (
  select o.id as org_id
  from public.organizations o
  where public.rls_is_superadmin()
     or public.rls_is_org_admin(o.id)
),
course_base as (
  select
    c.org_id,
    c.id as course_id,
    c.title,
    c.status::text as status,
    c.updated_at,
    c.published_at
  from public.courses c
  join org_access oa on oa.org_id = c.org_id
),
unit_counts as (
  select cu.course_id, count(*)::int as units_count
  from public.course_units cu
  group by cu.course_id
),
lesson_counts as (
  select cu.course_id, count(l.id)::int as lessons_count
  from public.course_units cu
  join public.lessons l on l.unit_id = cu.id
  group by cu.course_id
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
  join org_access oa on oa.org_id = l.org_id
),
local_assignments as (
  select
    la.course_id,
    count(*)::int as assigned_locals_count,
    coalesce(array_agg(la.name order by la.name), '{}'::text[])
      as assigned_locals_names,
    coalesce(array_agg(la.local_id order by la.name), '{}'::uuid[])
      as assigned_local_ids
  from (
    select distinct lc.course_id, l.id as local_id, l.name
    from public.local_courses lc
    join public.locals l on l.id = lc.local_id
    where lc.status = 'active'
  ) la
  group by la.course_id
),
org_locals as (
  select
    lb.org_id,
    jsonb_agg(
      jsonb_build_object(
        'local_id', lb.local_id,
        'name', lb.name,
        'status', lb.status
      )
      order by lb.name
    ) as org_locals
  from locals_base lb
  group by lb.org_id
)
select
  cb.org_id,
  cb.course_id,
  cb.title,
  cb.status,
  cb.updated_at,
  cb.published_at,
  coalesce(uc.units_count, 0) as units_count,
  coalesce(lc.lessons_count, 0) as lessons_count,
  coalesce(la.assigned_locals_count, 0) as assigned_locals_count,
  0::int as learners_assigned_count,
  coalesce(la.assigned_locals_names, '{}'::text[]) as assigned_locals_names,
  coalesce(la.assigned_local_ids, '{}'::uuid[]) as assigned_local_ids,
  coalesce(ol.org_locals, '[]'::jsonb) as org_locals
from course_base cb
left join unit_counts uc on uc.course_id = cb.course_id
left join lesson_counts lc on lc.course_id = cb.course_id
left join local_assignments la on la.course_id = cb.course_id
left join org_locals ol on ol.org_id = cb.org_id;

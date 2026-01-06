create or replace view public.v_org_local_courses as
select
  l.org_id,
  l.id as local_id,
  c.id as course_id,
  c.title,
  c.status::text as course_status,
  lc.status::text as assignment_status,
  (lc.status = 'active') as is_assigned,
  lc.assigned_at,
  lc.archived_at,
  c.category,
  null::boolean as is_mandatory,
  null::boolean as is_new,
  c.estimated_duration_minutes as duration_minutes,
  c.cover_image_url as thumbnail_url
from public.locals l
join public.courses c on c.org_id = l.org_id
left join public.local_courses lc
  on lc.local_id = l.id
 and lc.course_id = c.id
where
  public.rls_is_superadmin()
  or public.rls_is_org_admin(l.org_id)
order by
  (lc.status = 'active') desc,
  c.title asc,
  c.id asc;

-- Sanity checks (manual)
-- select * from public.v_org_local_courses where local_id = '<local_id>' limit 20;
-- select is_assigned, count(*) from public.v_org_local_courses where local_id = '<local_id>' group by 1;
-- select course_id, assignment_status, is_assigned from public.v_org_local_courses where local_id = '<local_id>' order by is_assigned desc, course_id asc;

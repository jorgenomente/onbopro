create or replace view public.v_org_course_metadata as
select
  c.org_id,
  c.id as course_id,
  c.title,
  c.description,
  c.status::text as status,
  c.updated_at,
  c.published_at,
  c.archived_at
from public.courses c
where
  public.rls_is_superadmin()
  or public.rls_is_org_admin(c.org_id);

-- select * from public.v_org_course_metadata where course_id = '<course_id>';

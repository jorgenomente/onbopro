create or replace view public.v_org_lesson_detail as
select
  c.org_id,
  c.id as course_id,
  cu.id as unit_id,
  l.id as lesson_id,
  l.title as lesson_title,
  l.content_type::text as lesson_type,
  case
    when l.content_type = 'text' then l.content->>'content_text'
    else null
  end as content_text,
  case
    when l.content_type = 'video_url' then l.content->>'video_url'
    else null
  end as video_url,
  case
    when l.content_type in ('file', 'link') then l.content->>'asset_url'
    else null
  end as asset_url,
  l.is_required,
  l.estimated_minutes,
  l.position,
  l.updated_at
from public.lessons l
join public.course_units cu on cu.id = l.unit_id
join public.courses c on c.id = cu.course_id
where
  public.rls_is_superadmin()
  or public.rls_is_org_admin(c.org_id);

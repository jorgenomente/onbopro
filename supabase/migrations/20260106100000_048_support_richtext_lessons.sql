create or replace view public.v_org_lesson_detail as
select
  c.org_id,
  c.id as course_id,
  cu.id as unit_id,
  l.id as lesson_id,
  l.title as lesson_title,
  l.content_type::text as lesson_type,
  case
    when l.content_type = 'text' then l.content->>'text'
    else null
  end as content_text,
  case
    when l.content_type in ('html', 'richtext')
      then coalesce(l.content->>'html', l.content->>'text')
    else null
  end as content_html,
  case
    when l.content_type in ('video', 'file', 'link') then l.content->>'url'
    else null
  end as content_url,
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

create or replace function public.rpc_update_lesson_content(
  p_lesson_id uuid,
  p_title text,
  p_content_text text,
  p_content_html text,
  p_content_url text,
  p_is_required boolean,
  p_estimated_minutes int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_lesson_type text;
  v_content jsonb;
begin
  select cu.course_id, l.content_type
    into v_course_id, v_lesson_type
  from public.lessons l
  join public.course_units cu on cu.id = l.unit_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_lesson_type = 'text' then
    if p_content_text is null or length(trim(p_content_text)) = 0 then
      raise exception 'content_text required' using errcode = '22023';
    end if;
    v_content := jsonb_build_object('text', p_content_text);
  elsif v_lesson_type in ('html', 'richtext') then
    if p_content_html is null or length(trim(p_content_html)) = 0 then
      raise exception 'content_html required' using errcode = '22023';
    end if;
    v_content := jsonb_build_object('html', p_content_html);
  elsif v_lesson_type in ('video', 'file', 'link') then
    if p_content_url is null or length(trim(p_content_url)) = 0 then
      raise exception 'content_url required' using errcode = '22023';
    end if;
    v_content := jsonb_build_object('url', p_content_url);
  else
    raise exception 'Invalid lesson_type' using errcode = '22023';
  end if;

  update public.lessons
  set
    title = coalesce(p_title, title),
    content = v_content,
    is_required = coalesce(p_is_required, is_required),
    estimated_minutes = p_estimated_minutes
  where id = p_lesson_id;
end;
$$;

grant execute on function public.rpc_update_lesson_content(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  int
) to authenticated;

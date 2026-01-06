create or replace function public.rpc_update_lesson_content(
  p_lesson_id uuid,
  p_title text,
  p_content_text text,
  p_video_url text,
  p_asset_url text,
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
    v_content := jsonb_build_object('content_text', p_content_text);
  elsif v_lesson_type = 'video_url' then
    if p_video_url is null or length(trim(p_video_url)) = 0 then
      raise exception 'video_url required' using errcode = '22023';
    end if;
    v_content := jsonb_build_object('video_url', p_video_url);
  elsif v_lesson_type in ('file', 'link') then
    if p_asset_url is null or length(trim(p_asset_url)) = 0 then
      raise exception 'asset_url required' using errcode = '22023';
    end if;
    v_content := jsonb_build_object('asset_url', p_asset_url);
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

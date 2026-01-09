create or replace function public.rpc_update_lesson_metadata(
  p_lesson_id uuid,
  p_title text,
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
  v_title text;
begin
  select cu.course_id
    into v_course_id
  from public.lessons l
  join public.course_units cu on cu.id = l.unit_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then
    raise exception 'title required' using errcode = '22023';
  end if;

  update public.lessons
  set
    title = v_title,
    is_required = coalesce(p_is_required, is_required),
    estimated_minutes = p_estimated_minutes
  where id = p_lesson_id;
end;
$$;

create or replace function public.rpc_update_template_lesson_metadata(
  p_lesson_id uuid,
  p_title text,
  p_is_required boolean,
  p_estimated_minutes int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then
    raise exception 'title required' using errcode = '22023';
  end if;

  update public.course_template_lessons
  set
    title = v_title,
    is_required = coalesce(p_is_required, is_required),
    estimated_minutes = p_estimated_minutes
  where lesson_id = p_lesson_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.rpc_update_lesson_metadata(uuid, text, boolean, int)
  to authenticated;
grant execute on function public.rpc_update_template_lesson_metadata(uuid, text, boolean, int)
  to authenticated;

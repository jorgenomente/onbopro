create or replace function rpc_mark_lesson_completed(
  p_local_id uuid,
  p_lesson_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_course_id uuid;
  v_unit_id uuid;
  v_is_member boolean;
  v_is_assigned boolean;
  v_rows int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select l.unit_id, cu.course_id
    into v_unit_id, v_course_id
  from lessons l
  join course_units cu on cu.id = l.unit_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'Lesson not found';
  end if;

  select l.org_id
    into v_org_id
  from locals l
  where l.id = p_local_id;

  if v_org_id is null then
    raise exception 'Local not found';
  end if;

  select exists (
    select 1
    from local_memberships lm
    where lm.local_id = p_local_id
      and lm.user_id = v_user_id
      and lm.role = 'aprendiz'
      and lm.status = 'active'
  ) into v_is_member;

  if not v_is_member then
    raise exception 'Not authorized';
  end if;

  select exists (
    select 1
    from local_courses lc
    where lc.local_id = p_local_id
      and lc.course_id = v_course_id
      and lc.status = 'active'
  ) into v_is_assigned;

  if not v_is_assigned then
    raise exception 'Course not assigned';
  end if;

  insert into lesson_completions (
    org_id,
    local_id,
    course_id,
    unit_id,
    lesson_id,
    user_id,
    completed_at
  ) values (
    v_org_id,
    p_local_id,
    v_course_id,
    v_unit_id,
    p_lesson_id,
    v_user_id,
    now()
  )
  on conflict (user_id, lesson_id)
  do update set
    completed_at = excluded.completed_at
  where lesson_completions.local_id = excluded.local_id
    and lesson_completions.course_id = excluded.course_id
    and lesson_completions.unit_id = excluded.unit_id;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

grant execute on function rpc_mark_lesson_completed(uuid, uuid) to authenticated;

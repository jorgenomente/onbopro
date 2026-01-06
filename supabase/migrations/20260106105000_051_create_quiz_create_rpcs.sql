create or replace function public.rpc_create_unit_quiz(
  p_unit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_quiz_id uuid;
  v_title text;
begin
  select cu.course_id, cu.title
    into v_course_id, v_title
  from public.course_units cu
  where cu.id = p_unit_id;

  if v_course_id is null then
    raise exception 'Unit not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select q.id
    into v_quiz_id
  from public.quizzes q
  where q.type = 'unit'
    and q.unit_id = p_unit_id
  limit 1;

  if v_quiz_id is not null then
    return v_quiz_id;
  end if;

  insert into public.quizzes (course_id, unit_id, type, title)
  values (
    v_course_id,
    p_unit_id,
    'unit',
    coalesce(v_title, 'Quiz de unidad')
  )
  returning id into v_quiz_id;

  return v_quiz_id;
end;
$$;

create or replace function public.rpc_create_final_quiz(
  p_course_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz_id uuid;
begin
  if p_course_id is null then
    raise exception 'Course required' using errcode = '22023';
  end if;

  if not public.can_manage_course(p_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select q.id
    into v_quiz_id
  from public.quizzes q
  where q.type = 'final'
    and q.course_id = p_course_id
  limit 1;

  if v_quiz_id is not null then
    return v_quiz_id;
  end if;

  insert into public.quizzes (course_id, unit_id, type, title)
  values (
    p_course_id,
    null,
    'final',
    'Evaluación final'
  )
  returning id into v_quiz_id;

  return v_quiz_id;
end;
$$;

revoke all on function public.rpc_create_unit_quiz(uuid) from public;
revoke all on function public.rpc_create_final_quiz(uuid) from public;

grant execute on function public.rpc_create_unit_quiz(uuid) to authenticated;
grant execute on function public.rpc_create_final_quiz(uuid) to authenticated;

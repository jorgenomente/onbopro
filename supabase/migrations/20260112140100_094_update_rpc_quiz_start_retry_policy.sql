create or replace function rpc_quiz_start(
  p_local_id uuid,
  p_quiz_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_course_id uuid;
  v_attempt_id uuid;
  v_attempt_no integer;
  v_max_attempts int;
  v_attempt_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select q.course_id, q.max_attempts
    into v_course_id, v_max_attempts
  from quizzes q
  where q.id = p_quiz_id;

  if v_course_id is null then
    raise exception 'Quiz not found';
  end if;

  v_max_attempts := coalesce(v_max_attempts, 3);

  select l.org_id into v_org_id
  from locals l
  where l.id = p_local_id;

  if v_org_id is null then
    raise exception 'Local not found';
  end if;

  if not exists (
    select 1
    from local_memberships lm
    where lm.local_id = p_local_id
      and lm.user_id = v_user_id
      and lm.role = 'aprendiz'
      and lm.status = 'active'
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from local_courses lc
    where lc.local_id = p_local_id
      and lc.course_id = v_course_id
      and lc.status = 'active'
  ) then
    raise exception 'Course not assigned';
  end if;

  if exists (
    select 1
    from quiz_attempts qa
    where qa.user_id = v_user_id
      and qa.quiz_id = p_quiz_id
      and qa.passed = true
  ) then
    raise exception 'Quiz already passed';
  end if;

  select qa.id into v_attempt_id
  from quiz_attempts qa
  where qa.local_id = p_local_id
    and qa.quiz_id = p_quiz_id
    and qa.user_id = v_user_id
    and qa.submitted_at is null
  order by qa.created_at desc
  limit 1;

  if v_attempt_id is not null then
    return v_attempt_id;
  end if;

  select count(*) into v_attempt_count
  from quiz_attempts qa
  where qa.quiz_id = p_quiz_id
    and qa.user_id = v_user_id;

  if v_attempt_count >= v_max_attempts then
    raise exception 'Max attempts reached';
  end if;

  select coalesce(max(attempt_no), 0) + 1
    into v_attempt_no
  from quiz_attempts
  where quiz_id = p_quiz_id
    and user_id = v_user_id;

  insert into quiz_attempts (
    org_id,
    local_id,
    course_id,
    quiz_id,
    user_id,
    attempt_no
  ) values (
    v_org_id,
    p_local_id,
    v_course_id,
    p_quiz_id,
    v_user_id,
    v_attempt_no
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

grant execute on function rpc_quiz_start(uuid, uuid) to authenticated;

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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select q.course_id into v_course_id
  from quizzes q
  where q.id = p_quiz_id;

  if v_course_id is null then
    raise exception 'Quiz not found';
  end if;

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

create or replace function rpc_quiz_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_option_id uuid default null,
  p_answer_text text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt quiz_attempts%rowtype;
  v_question_quiz_id uuid;
  v_option_question_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_option_id is null and p_answer_text is null then
    raise exception 'Answer payload required';
  end if;

  select * into v_attempt
  from quiz_attempts qa
  where qa.id = p_attempt_id;

  if v_attempt.id is null then
    raise exception 'Attempt not found';
  end if;

  if v_attempt.user_id <> v_user_id then
    raise exception 'Not authorized';
  end if;

  if v_attempt.submitted_at is not null then
    raise exception 'Attempt already submitted';
  end if;

  if not exists (
    select 1
    from local_memberships lm
    where lm.local_id = v_attempt.local_id
      and lm.user_id = v_user_id
      and lm.role = 'aprendiz'
      and lm.status = 'active'
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from local_courses lc
    where lc.local_id = v_attempt.local_id
      and lc.course_id = v_attempt.course_id
      and lc.status = 'active'
  ) then
    raise exception 'Course not assigned';
  end if;

  select qq.quiz_id into v_question_quiz_id
  from quiz_questions qq
  where qq.id = p_question_id;

  if v_question_quiz_id is null then
    raise exception 'Question not found';
  end if;

  if v_question_quiz_id <> v_attempt.quiz_id then
    raise exception 'Question does not belong to quiz';
  end if;

  if p_option_id is not null then
    select qo.question_id into v_option_question_id
    from quiz_options qo
    where qo.id = p_option_id;

    if v_option_question_id is null then
      raise exception 'Option not found';
    end if;

    if v_option_question_id <> p_question_id then
      raise exception 'Option does not belong to question';
    end if;
  end if;

  insert into quiz_answers (
    org_id,
    local_id,
    course_id,
    attempt_id,
    question_id,
    user_id,
    option_id,
    answer_text,
    created_at
  ) values (
    v_attempt.org_id,
    v_attempt.local_id,
    v_attempt.course_id,
    v_attempt.id,
    p_question_id,
    v_user_id,
    p_option_id,
    p_answer_text,
    now()
  )
  on conflict (attempt_id, question_id)
  do update set
    option_id = excluded.option_id,
    answer_text = excluded.answer_text,
    created_at = excluded.created_at;

  return true;
end;
$$;

grant execute on function rpc_quiz_answer(uuid, uuid, uuid, text) to authenticated;

create or replace function rpc_quiz_submit(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt quiz_attempts%rowtype;
  v_pass_percent integer;
  v_threshold integer;
  v_total_questions integer;
  v_correct integer;
  v_score integer;
  v_passed boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_attempt
  from quiz_attempts qa
  where qa.id = p_attempt_id;

  if v_attempt.id is null then
    raise exception 'Attempt not found';
  end if;

  if v_attempt.user_id <> v_user_id then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from local_memberships lm
    where lm.local_id = v_attempt.local_id
      and lm.user_id = v_user_id
      and lm.role = 'aprendiz'
      and lm.status = 'active'
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from local_courses lc
    where lc.local_id = v_attempt.local_id
      and lc.course_id = v_attempt.course_id
      and lc.status = 'active'
  ) then
    raise exception 'Course not assigned';
  end if;

  if v_attempt.submitted_at is not null then
    return jsonb_build_object('score', v_attempt.score, 'passed', v_attempt.passed);
  end if;

  -- Prefer quiz pass_percent when available, otherwise fallback to 70.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quizzes'
      and column_name = 'pass_percent'
  ) then
    execute 'select pass_percent from public.quizzes where id = $1'
      into v_pass_percent
      using v_attempt.quiz_id;
  end if;

  v_threshold := coalesce(v_pass_percent, 70);

  select count(*) into v_total_questions
  from quiz_questions qq
  where qq.quiz_id = v_attempt.quiz_id;

  select count(*) into v_correct
  from quiz_answers qa
  join quiz_options qo on qo.id = qa.option_id
  where qa.attempt_id = v_attempt.id
    and qo.is_correct = true;

  if v_total_questions = 0 then
    v_score := 0;
  else
    v_score := round((v_correct::numeric / v_total_questions) * 100)::int;
  end if;

  v_passed := v_score >= v_threshold;

  update quiz_attempts
  set submitted_at = now(),
      score = v_score,
      passed = v_passed
  where id = v_attempt.id;

  return jsonb_build_object('score', v_score, 'passed', v_passed);
end;
$$;

grant execute on function rpc_quiz_submit(uuid) to authenticated;

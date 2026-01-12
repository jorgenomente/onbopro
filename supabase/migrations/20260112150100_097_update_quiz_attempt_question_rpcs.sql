create or replace function public.rpc_update_quiz_metadata(
  p_quiz_id uuid,
  p_title text,
  p_description text,
  p_pass_score_pct numeric,
  p_shuffle_questions boolean,
  p_show_correct_answers boolean,
  p_num_questions int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_bank_size int;
begin
  select q.course_id
    into v_course_id
  from public.quizzes q
  where q.id = p_quiz_id;

  if v_course_id is null then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_title is not null and length(trim(p_title)) = 0 then
    raise exception 'title required' using errcode = '22023';
  end if;

  if p_pass_score_pct is not null
     and (p_pass_score_pct < 0 or p_pass_score_pct > 100) then
    raise exception 'pass_score_pct invalid' using errcode = '22023';
  end if;

  if p_num_questions is not null and p_num_questions < 1 then
    raise exception 'num_questions invalid' using errcode = '22023';
  end if;

  if p_num_questions is not null then
    select count(*)::int
      into v_bank_size
    from public.quiz_questions qq
    where qq.quiz_id = p_quiz_id
      and qq.archived_at is null;

    if v_bank_size = 0 then
      raise exception 'quiz has no questions' using errcode = '22023';
    end if;

    if p_num_questions > v_bank_size then
      raise exception 'num_questions exceeds question bank' using errcode = '22023';
    end if;
  end if;

  update public.quizzes
  set
    title = coalesce(p_title, title),
    description = p_description,
    pass_score_pct = coalesce(p_pass_score_pct, pass_score_pct),
    shuffle_questions = coalesce(p_shuffle_questions, shuffle_questions),
    show_correct_answers = coalesce(
      p_show_correct_answers,
      show_correct_answers
    ),
    num_questions = p_num_questions
  where id = p_quiz_id;
end;
$$;

grant execute on function public.rpc_update_quiz_metadata(
  uuid,
  text,
  text,
  numeric,
  boolean,
  boolean,
  int
) to authenticated;

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
  v_bank_size int;
  v_num_questions int;
  v_shuffle boolean;
  v_max_attempts int;
  v_attempt_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select q.course_id, q.num_questions, q.shuffle_questions, q.max_attempts
    into v_course_id, v_num_questions, v_shuffle, v_max_attempts
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

  select count(*)::int
    into v_bank_size
  from quiz_questions qq
  where qq.quiz_id = p_quiz_id
    and qq.archived_at is null;

  if v_bank_size = 0 then
    raise exception 'Quiz has no questions';
  end if;

  v_num_questions := coalesce(v_num_questions, v_bank_size);

  if v_num_questions > v_bank_size then
    raise exception 'num_questions exceeds question bank';
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

  with question_bank as (
    select qq.id, qq.position
    from quiz_questions qq
    where qq.quiz_id = p_quiz_id
      and qq.archived_at is null
  ),
  ordered as (
    select
      qb.id,
      row_number() over (
        order by
          case when v_shuffle then random() else qb.position end,
          qb.id
      ) as rn
    from question_bank qb
  ),
  selected as (
    select id, rn
    from ordered
    where rn <= v_num_questions
  )
  insert into quiz_attempt_questions (attempt_id, question_id, position)
  select v_attempt_id, id, rn
  from selected
  order by rn;

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

  if not exists (
    select 1
    from quiz_attempt_questions aq
    where aq.attempt_id = p_attempt_id
      and aq.question_id = p_question_id
  ) then
    raise exception 'Question not part of attempt';
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
  v_pass_score_pct int;
  v_threshold int;
  v_total_questions int;
  v_correct int;
  v_score int;
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

  select q.pass_score_pct::int
    into v_pass_score_pct
  from public.quizzes q
  where q.id = v_attempt.quiz_id;

  v_threshold := coalesce(v_pass_score_pct, 70);

  select count(*)::int into v_total_questions
  from quiz_attempt_questions aq
  where aq.attempt_id = v_attempt.id;

  select count(*)::int into v_correct
  from quiz_attempt_questions aq
  join quiz_answers qa on qa.question_id = aq.question_id
  join quiz_options qo on qo.id = qa.option_id
  where aq.attempt_id = v_attempt.id
    and qa.attempt_id = v_attempt.id
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

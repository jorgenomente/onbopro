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

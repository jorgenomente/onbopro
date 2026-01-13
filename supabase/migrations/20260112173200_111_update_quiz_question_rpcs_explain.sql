create or replace function public.rpc_create_quiz_question(
  p_quiz_id uuid,
  p_prompt text,
  p_explanation text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_position int;
  v_question_id uuid;
  v_explanation text;
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

  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  v_explanation := nullif(trim(coalesce(p_explanation, '')), '');

  select coalesce(max(position), 0) + 1
    into v_position
  from public.quiz_questions
  where quiz_id = p_quiz_id
    and position > 0;

  insert into public.quiz_questions (quiz_id, prompt, explanation, position)
  values (p_quiz_id, p_prompt, v_explanation, v_position)
  returning id into v_question_id;

  return v_question_id;
end;
$$;

create or replace function public.rpc_update_quiz_question(
  p_question_id uuid,
  p_prompt text,
  p_explanation text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_explanation text;
begin
  select q.course_id
    into v_course_id
  from public.quiz_questions qq
  join public.quizzes q on q.id = qq.quiz_id
  where qq.id = p_question_id;

  if v_course_id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  v_explanation := nullif(trim(coalesce(p_explanation, '')), '');

  update public.quiz_questions
  set
    prompt = p_prompt,
    explanation = v_explanation
  where id = p_question_id
    and archived_at is null;
end;
$$;

create or replace function public.rpc_create_quiz_question_full(
  p_quiz_id uuid,
  p_prompt text,
  p_choices text[],
  p_correct_index int,
  p_explanation text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_position int;
  v_question_id uuid;
  v_choice text;
  v_explanation text;
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

  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  if p_choices is null or array_length(p_choices, 1) <> 4 then
    raise exception 'choices must have 4 items' using errcode = '22023';
  end if;

  if p_correct_index is null or p_correct_index < 0 or p_correct_index > 3 then
    raise exception 'correct_index invalid' using errcode = '22023';
  end if;

  v_explanation := nullif(trim(coalesce(p_explanation, '')), '');

  select coalesce(max(position), 0) + 1
    into v_position
  from public.quiz_questions
  where quiz_id = p_quiz_id
    and position > 0;

  insert into public.quiz_questions (quiz_id, prompt, explanation, position)
  values (p_quiz_id, p_prompt, v_explanation, v_position)
  returning id into v_question_id;

  for i in 1..4 loop
    v_choice := trim(coalesce(p_choices[i], ''));
    if v_choice = '' then
      raise exception 'choice text required' using errcode = '22023';
    end if;
    insert into public.quiz_options (question_id, option_text, is_correct, position)
    values (v_question_id, v_choice, (i - 1 = p_correct_index), i);
  end loop;

  return v_question_id;
end;
$$;

revoke all on function public.rpc_create_quiz_question(uuid, text, text) from public;
revoke all on function public.rpc_update_quiz_question(uuid, text, text) from public;
revoke all on function public.rpc_create_quiz_question_full(uuid, text, text[], int, text) from public;

grant execute on function public.rpc_create_quiz_question(uuid, text, text) to authenticated;
grant execute on function public.rpc_update_quiz_question(uuid, text, text) to authenticated;
grant execute on function public.rpc_create_quiz_question_full(uuid, text, text[], int, text) to authenticated;

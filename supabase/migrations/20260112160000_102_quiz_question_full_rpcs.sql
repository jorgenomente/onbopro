create or replace function public.rpc_create_quiz_question_full(
  p_quiz_id uuid,
  p_prompt text,
  p_choices text[],
  p_correct_index int
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

  if p_choices is null or array_length(p_choices, 1) is null then
    raise exception 'choices required' using errcode = '22023';
  end if;

  if array_length(p_choices, 1) < 2 then
    raise exception 'at least 2 choices required' using errcode = '22023';
  end if;

  if p_correct_index is null
     or p_correct_index < 0
     or p_correct_index >= array_length(p_choices, 1) then
    raise exception 'correct_index invalid' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null;

  insert into public.quiz_questions (quiz_id, prompt, position)
  values (p_quiz_id, p_prompt, v_position)
  returning id into v_question_id;

  for i in 1..array_length(p_choices, 1) loop
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

grant execute on function public.rpc_create_quiz_question_full(uuid, text, text[], int) to authenticated;

create or replace function public.rpc_create_template_quiz_question_full(
  p_quiz_id uuid,
  p_prompt text,
  p_choices text[],
  p_correct_index int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position int;
  v_question_id uuid;
  v_choice text;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.course_template_quizzes q
    where q.quiz_id = p_quiz_id
  ) then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  if p_choices is null or array_length(p_choices, 1) is null then
    raise exception 'choices required' using errcode = '22023';
  end if;

  if array_length(p_choices, 1) < 2 then
    raise exception 'at least 2 choices required' using errcode = '22023';
  end if;

  if p_correct_index is null
     or p_correct_index < 0
     or p_correct_index >= array_length(p_choices, 1) then
    raise exception 'correct_index invalid' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.course_template_quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null;

  insert into public.course_template_quiz_questions (quiz_id, prompt, position)
  values (p_quiz_id, p_prompt, v_position)
  returning question_id into v_question_id;

  for i in 1..array_length(p_choices, 1) loop
    v_choice := trim(coalesce(p_choices[i], ''));
    if v_choice = '' then
      raise exception 'choice text required' using errcode = '22023';
    end if;
    insert into public.course_template_quiz_choices (
      question_id,
      option_text,
      is_correct,
      position
    ) values (
      v_question_id,
      v_choice,
      (i - 1 = p_correct_index),
      i
    );
  end loop;

  return v_question_id;
end;
$$;

grant execute on function public.rpc_create_template_quiz_question_full(uuid, text, text[], int) to authenticated;

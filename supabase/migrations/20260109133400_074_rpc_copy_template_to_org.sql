create or replace function public.rpc_copy_template_to_org(
  p_template_id uuid,
  p_org_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_template_title text;
  v_template_description text;
  v_template_status course_status;
  v_exists boolean;
  v_unit record;
  v_lesson record;
  v_quiz record;
  v_question record;
  v_choice record;
  v_course_unit_id uuid;
  v_course_quiz_id uuid;
  v_course_question_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_template_id is null or p_org_id is null then
    raise exception 'template_id and org_id required' using errcode = '22023';
  end if;

  select ct.title, ct.description, ct.status
    into v_template_title, v_template_description, v_template_status
  from public.course_templates ct
  where ct.template_id = p_template_id;

  if v_template_title is null then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;

  select count(*) > 0
    into v_exists
  from public.organizations o
  where o.id = p_org_id;

  if not v_exists then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  insert into public.courses (
    org_id,
    title,
    description,
    status,
    created_by,
    updated_by
  ) values (
    p_org_id,
    v_template_title,
    v_template_description,
    v_template_status,
    auth.uid(),
    auth.uid()
  )
  returning id into v_course_id;

  create temporary table _template_unit_map (
    template_unit_id uuid primary key,
    course_unit_id uuid not null
  ) on commit drop;

  create temporary table _template_quiz_map (
    template_quiz_id uuid primary key,
    course_quiz_id uuid not null
  ) on commit drop;

  create temporary table _template_question_map (
    template_question_id uuid primary key,
    course_question_id uuid not null
  ) on commit drop;

  for v_unit in
    select u.unit_id, u.title, u.position
    from public.course_template_units u
    where u.template_id = p_template_id
    order by u.position
  loop
    insert into public.course_units (course_id, title, position)
    values (v_course_id, v_unit.title, v_unit.position)
    returning id into v_course_unit_id;

    insert into _template_unit_map (template_unit_id, course_unit_id)
    values (v_unit.unit_id, v_course_unit_id);
  end loop;

  for v_lesson in
    select l.lesson_id,
           l.unit_id,
           l.title,
           l.position,
           l.content_type,
           l.content,
           l.estimated_minutes,
           l.is_required
    from public.course_template_lessons l
    where l.unit_id in (
      select unit_id
      from public.course_template_units
      where template_id = p_template_id
    )
    order by l.position
  loop
    select course_unit_id
      into v_course_unit_id
    from _template_unit_map
    where template_unit_id = v_lesson.unit_id;

    insert into public.lessons (
      unit_id,
      title,
      position,
      content_type,
      content,
      estimated_minutes,
      is_required
    ) values (
      v_course_unit_id,
      v_lesson.title,
      v_lesson.position,
      v_lesson.content_type,
      v_lesson.content,
      v_lesson.estimated_minutes,
      v_lesson.is_required
    );
  end loop;

  for v_quiz in
    select q.quiz_id,
           q.template_id,
           q.unit_id,
           q.type,
           q.title,
           q.description,
           q.time_limit_min,
           q.pass_score_pct,
           q.shuffle_questions,
           q.show_correct_answers
    from public.course_template_quizzes q
    where q.template_id = p_template_id
  loop
    if v_quiz.type = 'unit' then
      select course_unit_id
        into v_course_unit_id
      from _template_unit_map
      where template_unit_id = v_quiz.unit_id;
    else
      v_course_unit_id := null;
    end if;

    insert into public.quizzes (
      course_id,
      unit_id,
      type,
      title,
      description,
      time_limit_min,
      pass_score_pct,
      shuffle_questions,
      show_correct_answers
    ) values (
      v_course_id,
      v_course_unit_id,
      v_quiz.type,
      v_quiz.title,
      v_quiz.description,
      v_quiz.time_limit_min,
      v_quiz.pass_score_pct,
      v_quiz.shuffle_questions,
      v_quiz.show_correct_answers
    )
    returning id into v_course_quiz_id;

    insert into _template_quiz_map (template_quiz_id, course_quiz_id)
    values (v_quiz.quiz_id, v_course_quiz_id);
  end loop;

  for v_question in
    select qq.question_id,
           qq.quiz_id,
           qq.position,
           qq.prompt
    from public.course_template_quiz_questions qq
    where qq.quiz_id in (
      select quiz_id
      from public.course_template_quizzes
      where template_id = p_template_id
    )
      and qq.archived_at is null
    order by qq.position
  loop
    select course_quiz_id
      into v_course_quiz_id
    from _template_quiz_map
    where template_quiz_id = v_question.quiz_id;

    insert into public.quiz_questions (quiz_id, position, prompt)
    values (v_course_quiz_id, v_question.position, v_question.prompt)
    returning id into v_course_question_id;

    insert into _template_question_map (template_question_id, course_question_id)
    values (v_question.question_id, v_course_question_id);
  end loop;

  for v_choice in
    select qc.choice_id,
           qc.question_id,
           qc.position,
           qc.option_text,
           qc.is_correct
    from public.course_template_quiz_choices qc
    where qc.question_id in (
      select question_id
      from public.course_template_quiz_questions
      where quiz_id in (
        select quiz_id
        from public.course_template_quizzes
        where template_id = p_template_id
      )
      and archived_at is null
    )
    order by qc.position
  loop
    select course_question_id
      into v_course_question_id
    from _template_question_map
    where template_question_id = v_choice.question_id;

    insert into public.quiz_options (
      question_id,
      position,
      option_text,
      is_correct
    ) values (
      v_course_question_id,
      v_choice.position,
      v_choice.option_text,
      v_choice.is_correct
    );
  end loop;

  return v_course_id;
end;
$$;

revoke all on function public.rpc_copy_template_to_org(uuid, uuid) from public;
grant execute on function public.rpc_copy_template_to_org(uuid, uuid) to authenticated;

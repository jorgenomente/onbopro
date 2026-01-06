-- DEV ONLY: seed minimo de quizzes para habilitar navegacion Outline -> Quiz
-- Ejecutar solo en entorno de desarrollo/local.
-- Idempotente: reusa quizzes y no duplica preguntas/opciones.

do $$
declare
  v_local_id uuid;
  v_course_id uuid;
  v_unit_id uuid;
  v_unit_quiz_id uuid;
  v_final_quiz_id uuid;
  v_quiz_id uuid;
  v_question_id uuid;
begin
  select lc.local_id, lc.course_id
  into v_local_id, v_course_id
  from public.local_courses lc
  where lc.status = 'active'
  order by lc.assigned_at nulls last
  limit 1;

  if v_local_id is null or v_course_id is null then
    raise notice 'DEV seed: no hay local_courses active; se omite.';
    return;
  end if;

  select cu.id
  into v_unit_id
  from public.course_units cu
  where cu.course_id = v_course_id
  order by cu.position
  limit 1;

  if v_unit_id is null then
    raise notice 'DEV seed: curso sin unidades; se omite.';
    return;
  end if;

  -- Quiz de unidad (type = unit)
  select q.id
  into v_unit_quiz_id
  from public.quizzes q
  where q.type = 'unit'
    and q.unit_id = v_unit_id
  limit 1;

  if v_unit_quiz_id is null then
    insert into public.quizzes (id, course_id, unit_id, type, title, created_at)
    values (
      gen_random_uuid(),
      v_course_id,
      v_unit_id,
      'unit',
      'Evaluacion unidad (DEV)',
      now()
    )
    returning id into v_unit_quiz_id;
  end if;

  -- Quiz final (type = final)
  select q.id
  into v_final_quiz_id
  from public.quizzes q
  where q.type = 'final'
    and q.course_id = v_course_id
  limit 1;

  if v_final_quiz_id is null then
    insert into public.quizzes (id, course_id, unit_id, type, title, created_at)
    values (
      gen_random_uuid(),
      v_course_id,
      null,
      'final',
      'Evaluacion final (DEV)',
      now()
    )
    returning id into v_final_quiz_id;
  end if;

  -- Seed minimo de preguntas/opciones para ambos quizzes
  for v_quiz_id in
    select quiz_id
    from unnest(array[v_unit_quiz_id, v_final_quiz_id]) as quiz_id
    where quiz_id is not null
  loop
    -- Pregunta 1
    if not exists (
      select 1
      from public.quiz_questions qq
      where qq.quiz_id = v_quiz_id and qq.position = 1
    ) then
      insert into public.quiz_questions (id, quiz_id, position, prompt, created_at)
      values (
        gen_random_uuid(),
        v_quiz_id,
        1,
        'Pregunta 1 (DEV)',
        now()
      )
      returning id into v_question_id;
    else
      select qq.id into v_question_id
      from public.quiz_questions qq
      where qq.quiz_id = v_quiz_id and qq.position = 1;
    end if;

    insert into public.quiz_options (id, question_id, position, option_text, is_correct, created_at)
    values (gen_random_uuid(), v_question_id, 1, 'Opcion correcta', true, now())
    on conflict (question_id, position) do nothing;

    insert into public.quiz_options (id, question_id, position, option_text, is_correct, created_at)
    values (gen_random_uuid(), v_question_id, 2, 'Opcion incorrecta', false, now())
    on conflict (question_id, position) do nothing;

    -- Pregunta 2
    if not exists (
      select 1
      from public.quiz_questions qq
      where qq.quiz_id = v_quiz_id and qq.position = 2
    ) then
      insert into public.quiz_questions (id, quiz_id, position, prompt, created_at)
      values (
        gen_random_uuid(),
        v_quiz_id,
        2,
        'Pregunta 2 (DEV)',
        now()
      )
      returning id into v_question_id;
    else
      select qq.id into v_question_id
      from public.quiz_questions qq
      where qq.quiz_id = v_quiz_id and qq.position = 2;
    end if;

    insert into public.quiz_options (id, question_id, position, option_text, is_correct, created_at)
    values (gen_random_uuid(), v_question_id, 1, 'Opcion correcta', true, now())
    on conflict (question_id, position) do nothing;

    insert into public.quiz_options (id, question_id, position, option_text, is_correct, created_at)
    values (gen_random_uuid(), v_question_id, 2, 'Opcion incorrecta', false, now())
    on conflict (question_id, position) do nothing;
  end loop;

  raise notice 'DEV seed: quizzes creados/reusados para course %, unit %', v_course_id, v_unit_id;
end $$;

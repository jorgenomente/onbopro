create or replace view public.v_superadmin_course_templates as
select
  ct.template_id,
  ct.title,
  ct.description,
  ct.status::text as status,
  ct.created_at,
  ct.updated_at
from public.course_templates ct
where public.rls_is_superadmin();

create or replace view public.v_superadmin_course_template_outline as
select
  ct.template_id as course_id,
  ct.title as course_title,
  ct.status::text as course_status,
  coalesce(units.units, '[]'::jsonb) as units,
  final_quiz.final_quiz
from public.course_templates ct
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'unit_id', u.unit_id,
      'title', u.title,
      'position', u.position,
      'lessons', coalesce(lessons.lessons, '[]'::jsonb),
      'unit_quiz', unit_quiz.unit_quiz
    )
    order by u.position
  ) as units
  from public.course_template_units u
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'lesson_id', l.lesson_id,
        'title', l.title,
        'lesson_type', l.content_type,
        'position', l.position,
        'estimated_minutes', l.estimated_minutes,
        'is_required', l.is_required
      )
      order by l.position
    ) as lessons
    from public.course_template_lessons l
    where l.unit_id = u.unit_id
  ) lessons on true
  left join lateral (
    select jsonb_build_object(
      'quiz_id', q.quiz_id,
      'title', q.title,
      'questions_count', coalesce(qc.questions_count, 0),
      'pass_score_pct', q.pass_score_pct
    ) as unit_quiz
    from public.course_template_quizzes q
    left join lateral (
      select count(*)::int as questions_count
      from public.course_template_quiz_questions qq
      where qq.quiz_id = q.quiz_id
        and qq.archived_at is null
    ) qc on true
    where q.type = 'unit'
      and q.unit_id = u.unit_id
    limit 1
  ) unit_quiz on true
  where u.template_id = ct.template_id
) units on true
left join lateral (
  select jsonb_build_object(
    'quiz_id', q.quiz_id,
    'title', q.title,
    'questions_count', coalesce(qc.questions_count, 0),
    'pass_score_pct', q.pass_score_pct
  ) as final_quiz
  from public.course_template_quizzes q
  left join lateral (
    select count(*)::int as questions_count
    from public.course_template_quiz_questions qq
    where qq.quiz_id = q.quiz_id
      and qq.archived_at is null
  ) qc on true
  where q.type = 'final'
    and q.template_id = ct.template_id
  limit 1
) final_quiz on true
where public.rls_is_superadmin();

create or replace view public.v_superadmin_course_template_metadata as
select
  null::uuid as org_id,
  ct.template_id as course_id,
  ct.title,
  ct.description,
  ct.status::text as status,
  ct.updated_at,
  null::timestamptz as published_at,
  null::timestamptz as archived_at
from public.course_templates ct
where public.rls_is_superadmin();

create or replace view public.v_superadmin_template_lesson_detail as
select
  null::uuid as org_id,
  ct.template_id as course_id,
  u.unit_id,
  l.lesson_id,
  l.title as lesson_title,
  l.content_type::text as lesson_type,
  case
    when l.content_type = 'text' then l.content->>'text'
    else null
  end as content_text,
  case
    when l.content_type in ('html', 'richtext')
      then coalesce(l.content->>'html', l.content->>'text')
    else null
  end as content_html,
  case
    when l.content_type in ('video', 'file', 'link') then l.content->>'url'
    else null
  end as content_url,
  l.is_required,
  l.estimated_minutes,
  l.position,
  l.updated_at
from public.course_template_lessons l
join public.course_template_units u on u.unit_id = l.unit_id
join public.course_templates ct on ct.template_id = u.template_id
where public.rls_is_superadmin();

create or replace view public.v_superadmin_template_quiz_detail as
select
  null::uuid as org_id,
  ct.template_id as course_id,
  q.unit_id,
  q.quiz_id,
  q.type::text as quiz_type,
  q.title,
  q.description,
  q.pass_score_pct,
  q.shuffle_questions,
  q.show_correct_answers,
  coalesce(questions.questions, '[]'::jsonb) as questions,
  q.updated_at
from public.course_template_quizzes q
join public.course_templates ct on ct.template_id = q.template_id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'question_id', qq.question_id,
      'prompt', qq.prompt,
      'position', qq.position,
      'choices', coalesce(choices.choices, '[]'::jsonb)
    )
    order by qq.position, qq.question_id
  ) as questions
  from public.course_template_quiz_questions qq
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'choice_id', qo.choice_id,
        'text', qo.option_text,
        'position', qo.position,
        'is_correct', qo.is_correct
      )
      order by qo.position, qo.choice_id
    ) as choices
    from public.course_template_quiz_choices qo
    where qo.question_id = qq.question_id
  ) choices on true
  where qq.quiz_id = q.quiz_id
    and qq.archived_at is null
) questions on true
where public.rls_is_superadmin();

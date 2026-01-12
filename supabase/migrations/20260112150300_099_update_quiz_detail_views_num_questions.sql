drop view if exists public.v_org_quiz_detail;
drop view if exists public.v_superadmin_template_quiz_detail;

create or replace view public.v_org_quiz_detail as
select
  c.org_id,
  q.course_id,
  q.unit_id,
  q.id as quiz_id,
  q.type::text as quiz_type,
  q.title,
  q.description,
  q.pass_score_pct,
  q.shuffle_questions,
  q.show_correct_answers,
  q.num_questions,
  coalesce(questions.questions, '[]'::jsonb) as questions,
  q.updated_at
from public.quizzes q
join public.courses c on c.id = q.course_id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'question_id', qq.id,
      'prompt', qq.prompt,
      'position', qq.position,
      'choices', coalesce(choices.choices, '[]'::jsonb)
    )
    order by qq.position, qq.id
  ) as questions
  from public.quiz_questions qq
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'choice_id', qo.id,
        'text', qo.option_text,
        'position', qo.position,
        'is_correct', qo.is_correct
      )
      order by qo.position, qo.id
    ) as choices
    from public.quiz_options qo
    where qo.question_id = qq.id
  ) choices on true
  where qq.quiz_id = q.id
    and qq.archived_at is null
) questions on true
where
  public.rls_is_superadmin()
  or public.rls_is_org_admin(c.org_id);

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
  null::int as num_questions,
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

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
) questions on true
where
  public.rls_is_superadmin()
  or public.rls_is_org_admin(c.org_id);

-- Sanity checks (manual)
-- select * from public.v_org_quiz_detail limit 5;
-- select quiz_id, jsonb_typeof(questions) from public.v_org_quiz_detail limit 5;
-- select jsonb_array_length(questions) from public.v_org_quiz_detail where quiz_id = '<quiz_id>';
-- select jsonb_array_length((questions->0->'choices')) from public.v_org_quiz_detail where quiz_id = '<quiz_id>';
-- select quiz_id from public.v_org_quiz_detail where quiz_id = '<quiz_id>';

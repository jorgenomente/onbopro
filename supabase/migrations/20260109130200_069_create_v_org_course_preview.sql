create or replace view public.v_org_course_preview as
select
  c.org_id,
  c.id as course_id,
  c.title,
  c.description,
  c.status::text as status,
  coalesce(units.units, '[]'::jsonb) as units,
  final_quiz.final_quiz
from public.courses c
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'unit_id', u.id,
      'title', u.title,
      'position', u.position,
      'lessons', coalesce(lessons.lessons, '[]'::jsonb),
      'unit_quiz', unit_quiz.unit_quiz
    )
    order by u.position
  ) as units
  from public.course_units u
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'lesson_id', l.id,
        'title', l.title,
        'lesson_type', l.content_type,
        'position', l.position,
        'estimated_minutes', l.estimated_minutes,
        'is_required', l.is_required
      )
      order by l.position
    ) as lessons
    from public.lessons l
    where l.unit_id = u.id
  ) lessons on true
  left join lateral (
    select jsonb_build_object(
      'quiz_id', q.id,
      'title', q.title,
      'questions_count', coalesce(qc.questions_count, 0),
      'pass_score_pct', q.pass_score_pct
    ) as unit_quiz
    from public.quizzes q
    left join lateral (
      select count(*)::int as questions_count
      from public.quiz_questions qq
      where qq.quiz_id = q.id
    ) qc on true
    where q.type = 'unit'
      and q.unit_id = u.id
    limit 1
  ) unit_quiz on true
  where u.course_id = c.id
) units on true
left join lateral (
  select jsonb_build_object(
    'quiz_id', q.id,
    'title', q.title,
    'questions_count', coalesce(qc.questions_count, 0),
    'pass_score_pct', q.pass_score_pct
  ) as final_quiz
  from public.quizzes q
  left join lateral (
    select count(*)::int as questions_count
    from public.quiz_questions qq
    where qq.quiz_id = q.id
  ) qc on true
  where q.type = 'final'
    and q.course_id = c.id
  limit 1
) final_quiz on true
where
  public.rls_is_superadmin()
  or public.rls_is_org_admin(c.org_id);

-- select * from public.v_org_course_preview where course_id = '<course_id>';

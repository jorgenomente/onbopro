create or replace view public.v_superadmin_course_template_outline as
select
  ct.template_id as course_id,
  ct.title as course_title,
  ct.status::text as course_status,
  coalesce(units.units, '[]'::jsonb) as units,
  final_quiz.final_quiz,
  coalesce(orgs.organizations, '[]'::jsonb) as organizations
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
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'org_id', o.id,
      'name', o.name,
      'status', case when o.archived_at is null then 'active' else 'archived' end,
      'admin_email', admin_email.admin_email
    )
    order by o.name
  ) as organizations
  from public.organizations o
  left join lateral (
    select p.email as admin_email
    from public.org_memberships om
    join public.profiles p on p.user_id = om.user_id
    where om.org_id = o.id
      and om.role = 'org_admin'
      and om.status = 'active'
    order by p.email
    limit 1
  ) admin_email on true
) orgs on true
where public.rls_is_superadmin();

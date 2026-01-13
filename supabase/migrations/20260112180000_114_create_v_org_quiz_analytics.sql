create or replace view public.v_org_quiz_analytics as
with org_access as (
  select o.id as org_id
  from public.organizations o
  where public.rls_is_superadmin()
     or public.rls_is_org_admin(o.id)
)
select
  qa.org_id,
  qa.course_id,
  qa.quiz_id,
  q.title as quiz_title,
  count(*)::int as attempt_count,
  count(*) filter (where qa.submitted_at is not null)::int as submitted_count,
  count(*) filter (
    where qa.submitted_at is not null and qa.passed is true
  )::int as pass_count,
  case
    when count(*) filter (where qa.submitted_at is not null) > 0
      then count(*) filter (
        where qa.submitted_at is not null and qa.passed is true
      )::numeric
        / count(*) filter (where qa.submitted_at is not null)
    else null
  end as pass_rate,
  avg(qa.score) filter (where qa.submitted_at is not null) as avg_score,
  min(qa.submitted_at) filter (where qa.submitted_at is not null) as first_attempt_at,
  max(qa.submitted_at) filter (where qa.submitted_at is not null) as last_attempt_at
from public.quiz_attempts qa
join org_access oa on oa.org_id = qa.org_id
join public.quizzes q on q.id = qa.quiz_id
group by qa.org_id, qa.course_id, qa.quiz_id, q.title;

create or replace view public.v_org_quiz_question_analytics as
with org_access as (
  select o.id as org_id
  from public.organizations o
  where public.rls_is_superadmin()
     or public.rls_is_org_admin(o.id)
),
submitted_attempts as (
  select qa.*
  from public.quiz_attempts qa
  join org_access oa on oa.org_id = qa.org_id
  where qa.submitted_at is not null
),
seen as (
  select
    qa.org_id,
    qa.course_id,
    qa.quiz_id,
    qaq.question_id
  from public.quiz_attempt_questions qaq
  join submitted_attempts qa on qa.id = qaq.attempt_id
),
seen_agg as (
  select
    s.org_id,
    s.course_id,
    s.quiz_id,
    s.question_id,
    count(*)::int as seen_count
  from seen s
  group by s.org_id, s.course_id, s.quiz_id, s.question_id
),
answers as (
  select
    qa.org_id,
    qa.course_id,
    qa.quiz_id,
    ans.question_id,
    ans.option_id
  from public.quiz_answers ans
  join submitted_attempts qa on qa.id = ans.attempt_id
),
answers_scored as (
  select
    a.org_id,
    a.course_id,
    a.quiz_id,
    a.question_id,
    a.option_id,
    opt.is_correct
  from answers a
  left join public.quiz_options opt on opt.id = a.option_id
),
answers_agg as (
  select
    a.org_id,
    a.course_id,
    a.quiz_id,
    a.question_id,
    count(*)::int as answered_count,
    count(*) filter (where a.option_id is not null and a.is_correct is true)::int as correct_count,
    count(*) filter (where a.option_id is not null and a.is_correct is false)::int as incorrect_count
  from answers_scored a
  group by a.org_id, a.course_id, a.quiz_id, a.question_id
)
select
  s.org_id,
  s.course_id,
  s.quiz_id,
  s.question_id,
  qq.prompt,
  s.seen_count,
  coalesce(a.answered_count, 0) as answered_count,
  coalesce(a.correct_count, 0) as correct_count,
  coalesce(a.incorrect_count, 0) as incorrect_count,
  case
    when coalesce(a.correct_count, 0) + coalesce(a.incorrect_count, 0) > 0
      then coalesce(a.correct_count, 0)::numeric
        / (coalesce(a.correct_count, 0) + coalesce(a.incorrect_count, 0))
    else null
  end as correct_rate
from seen_agg s
join public.quiz_questions qq on qq.id = s.question_id
left join answers_agg a
  on a.org_id = s.org_id
 and a.course_id = s.course_id
 and a.quiz_id = s.quiz_id
 and a.question_id = s.question_id;

-- Note: free text answers (option_id is null) count toward answered_count but not correct/incorrect.

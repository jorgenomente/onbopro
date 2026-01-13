create or replace view public.v_org_quiz_option_analytics as
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
answers as (
  select
    qa.org_id,
    qa.course_id,
    qa.quiz_id,
    ans.question_id,
    ans.option_id
  from public.quiz_answers ans
  join submitted_attempts qa on qa.id = ans.attempt_id
  where ans.option_id is not null
),
answers_agg as (
  select
    a.org_id,
    a.course_id,
    a.quiz_id,
    a.question_id,
    a.option_id,
    count(*)::int as picked_count
  from answers a
  group by a.org_id, a.course_id, a.quiz_id, a.question_id, a.option_id
)
select
  aa.org_id,
  aa.course_id,
  aa.quiz_id,
  aa.question_id,
  aa.option_id,
  qo.option_text,
  qo.is_correct,
  aa.picked_count,
  case
    when sum(aa.picked_count) over (partition by aa.org_id, aa.quiz_id, aa.question_id) > 0
      then aa.picked_count::numeric
        / sum(aa.picked_count) over (partition by aa.org_id, aa.quiz_id, aa.question_id)
    else null
  end as picked_rate
from answers_agg aa
join public.quiz_options qo on qo.id = aa.option_id;

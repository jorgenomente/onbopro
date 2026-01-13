create or replace view public.v_ref_quiz_option_analytics as
with local_access as (
  select l.id as local_id
  from public.locals l
  where public.rls_is_superadmin()
     or public.rls_is_local_referente(l.id)
),
submitted_attempts as (
  select qa.*
  from public.quiz_attempts qa
  join local_access la on la.local_id = qa.local_id
  where qa.submitted_at is not null
),
answers as (
  select
    qa.local_id,
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
    a.local_id,
    a.course_id,
    a.quiz_id,
    a.question_id,
    a.option_id,
    count(*)::int as picked_count
  from answers a
  group by a.local_id, a.course_id, a.quiz_id, a.question_id, a.option_id
)
select
  aa.local_id,
  aa.course_id,
  aa.quiz_id,
  aa.question_id,
  aa.option_id,
  qo.option_text,
  qo.is_correct,
  aa.picked_count,
  case
    when sum(aa.picked_count) over (partition by aa.local_id, aa.quiz_id, aa.question_id) > 0
      then aa.picked_count::numeric
        / sum(aa.picked_count) over (partition by aa.local_id, aa.quiz_id, aa.question_id)
    else null
  end as picked_rate
from answers_agg aa
join public.quiz_options qo on qo.id = aa.option_id;

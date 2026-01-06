create or replace view public.v_ref_learners as
with ref_access as (
  select lm.local_id
  from public.local_memberships lm
  where lm.user_id = auth.uid()
    and lm.status = 'active'
    and lm.role = 'referente'
),
learners as (
  select
    lm.local_id,
    lm.user_id as learner_id,
    lm.status::text as membership_status,
    lm.created_at as membership_created_at,
    coalesce(p.full_name, p.email) as learner_name,
    p.email as learner_email
  from public.local_memberships lm
  join ref_access ra on ra.local_id = lm.local_id
  left join public.profiles p on p.user_id = lm.user_id
  where lm.status = 'active'
    and lm.role = 'aprendiz'
),
assigned_lessons as (
  select ac.local_id, l.id as lesson_id
  from public.local_courses ac
  join ref_access ra on ra.local_id = ac.local_id
  join public.course_units cu on cu.course_id = ac.course_id
  join public.lessons l on l.unit_id = cu.id
  where ac.status = 'active'
),
lesson_totals as (
  select al.local_id, count(distinct al.lesson_id)::int as total_lessons
  from assigned_lessons al
  group by al.local_id
),
learner_completions as (
  select
    lc.local_id,
    lc.user_id as learner_id,
    count(*)::int as completed_lessons,
    max(lc.completed_at) as last_completion_at
  from public.lesson_completions lc
  join learners l
    on l.local_id = lc.local_id
   and l.learner_id = lc.user_id
  join assigned_lessons al
    on al.local_id = lc.local_id
   and al.lesson_id = lc.lesson_id
  group by lc.local_id, lc.user_id
),
learner_quiz_scores as (
  select
    qa.local_id,
    qa.user_id as learner_id,
    avg(qa.score)::numeric as avg_score,
    max(qa.submitted_at) as last_quiz_submit_at
  from public.quiz_attempts qa
  join learners l
    on l.local_id = qa.local_id
   and l.learner_id = qa.user_id
  join public.local_courses lc
    on lc.local_id = qa.local_id
   and lc.course_id = qa.course_id
   and lc.status = 'active'
  where qa.submitted_at is not null
  group by qa.local_id, qa.user_id
),
last_event_base as (
  select
    lc.local_id,
    lc.user_id as learner_id,
    lc.completed_at as occurred_at,
    lc.course_id,
    c.title as course_title
  from public.lesson_completions lc
  join learners l
    on l.local_id = lc.local_id
   and l.learner_id = lc.user_id
  join public.courses c on c.id = lc.course_id
  union all
  select
    qa.local_id,
    qa.user_id as learner_id,
    qa.submitted_at as occurred_at,
    qa.course_id,
    c.title as course_title
  from public.quiz_attempts qa
  join learners l
    on l.local_id = qa.local_id
   and l.learner_id = qa.user_id
  join public.courses c on c.id = qa.course_id
  where qa.submitted_at is not null
),
last_event as (
  select
    leb.*,
    row_number() over (
      partition by leb.local_id, leb.learner_id
      order by leb.occurred_at desc
    ) as rn
  from last_event_base leb
),
last_activity as (
  select
    l.local_id,
    l.learner_id,
    greatest(lc.last_completion_at, lq.last_quiz_submit_at) as last_activity_at
  from learners l
  left join learner_completions lc
    on lc.local_id = l.local_id
   and lc.learner_id = l.learner_id
  left join learner_quiz_scores lq
    on lq.local_id = l.local_id
   and lq.learner_id = l.learner_id
)
select
  l.local_id,
  l.learner_id,
  l.learner_name,
  l.learner_email,
  l.membership_status,
  l.membership_created_at,
  la.last_activity_at,
  coalesce(lc.completed_lessons, 0) as completed_lessons,
  coalesce(lt.total_lessons, 0) as total_lessons,
  case
    when coalesce(lt.total_lessons, 0) = 0 then 0
    else round(
      100.0 * coalesce(lc.completed_lessons, 0)
      / nullif(lt.total_lessons, 0)
    )::int
  end as completion_percent,
  lq.avg_score,
  case
    when coalesce(lt.total_lessons, 0) > 0
     and (
       case
         when coalesce(lt.total_lessons, 0) = 0 then 0
         else round(
           100.0 * coalesce(lc.completed_lessons, 0)
           / nullif(lt.total_lessons, 0)
         )::int
       end
     ) = 100 then 'graduated'
    when la.last_activity_at is null
      or la.last_activity_at < now() - interval '14 days' then 'inactive'
    else 'active'
  end::text as learner_state,
  case
    when la.last_activity_at is null
      or la.last_activity_at < now() - interval '21 days' then 'danger'
    when la.last_activity_at < now() - interval '14 days' then 'warning'
    else 'none'
  end::text as risk_level,
  case
    when la.last_activity_at >= now() - interval '7 days' then true
    else false
  end as recent_flag,
  le.course_id as current_course_id,
  le.course_title as current_course_title
from learners l
left join learner_completions lc
  on lc.local_id = l.local_id
 and lc.learner_id = l.learner_id
left join learner_quiz_scores lq
  on lq.local_id = l.local_id
 and lq.learner_id = l.learner_id
left join lesson_totals lt
  on lt.local_id = l.local_id
left join last_activity la
  on la.local_id = l.local_id
 and la.learner_id = l.learner_id
left join last_event le
  on le.local_id = l.local_id
 and le.learner_id = l.learner_id
 and le.rn = 1;

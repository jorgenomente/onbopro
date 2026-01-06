create or replace view public.v_ref_dashboard as
with local_ctx as (
  select l.id as local_id, l.name as local_name
  from public.locals l
),
learners as (
  select lm.local_id, lm.user_id, lm.created_at
  from public.local_memberships lm
  where lm.status = 'active'
    and lm.role = 'aprendiz'
),
assigned_courses as (
  select lc.local_id, lc.course_id
  from public.local_courses lc
  where lc.status = 'active'
),
assigned_lessons as (
  select ac.local_id, l.id as lesson_id
  from assigned_courses ac
  join public.course_units cu on cu.course_id = ac.course_id
  join public.lessons l on l.unit_id = cu.id
),
completions as (
  select lc.local_id, lc.user_id, lc.lesson_id, lc.course_id, lc.completed_at
  from public.lesson_completions lc
  join learners ln
    on ln.local_id = lc.local_id
   and ln.user_id = lc.user_id
  join assigned_courses ac
    on ac.local_id = lc.local_id
   and ac.course_id = lc.course_id
),
quiz_submits as (
  select qa.local_id, qa.user_id, qa.course_id, qa.score, qa.submitted_at
  from public.quiz_attempts qa
  join learners ln
    on ln.local_id = qa.local_id
   and ln.user_id = qa.user_id
  join assigned_courses ac
    on ac.local_id = qa.local_id
   and ac.course_id = qa.course_id
  where qa.submitted_at is not null
),
learner_counts as (
  select
    l.local_id,
    count(*)::int as learners_count,
    count(*) filter (
      where l.created_at >= now() - interval '7 days'
    )::int as learners_new_count
  from learners l
  group by l.local_id
),
course_counts as (
  select ac.local_id, count(*)::int as active_courses_count
  from assigned_courses ac
  group by ac.local_id
),
lesson_counts as (
  select al.local_id, count(*)::int as total_lessons
  from assigned_lessons al
  group by al.local_id
),
completion_counts as (
  select c.local_id, count(*)::int as completed_lessons, max(c.completed_at) as max_completed_at
  from completions c
  group by c.local_id
),
quiz_counts as (
  select q.local_id, avg(q.score)::numeric as avg_score, max(q.submitted_at) as max_submitted_at
  from quiz_submits q
  group by q.local_id
),
activity_base as (
  select
    c.local_id,
    c.completed_at as occurred_at,
    c.user_id as learner_id,
    coalesce(p.full_name, p.email) as learner_name,
    'lesson_completed'::text as event_type,
    'Completó una lección'::text as label,
    c.course_id,
    crs.title as course_title
  from completions c
  join public.courses crs on crs.id = c.course_id
  left join public.profiles p on p.user_id = c.user_id
  union all
  select
    q.local_id,
    q.submitted_at as occurred_at,
    q.user_id as learner_id,
    coalesce(p.full_name, p.email) as learner_name,
    'quiz_submitted'::text as event_type,
    'Envió una evaluación'::text as label,
    q.course_id,
    crs.title as course_title
  from quiz_submits q
  join public.courses crs on crs.id = q.course_id
  left join public.profiles p on p.user_id = q.user_id
),
activity_ranked as (
  select
    ab.*,
    row_number() over (
      partition by ab.local_id
      order by ab.occurred_at desc
    ) as rn
  from activity_base ab
),
activity_json as (
  select
    ar.local_id,
    jsonb_agg(
      jsonb_build_object(
        'occurred_at', ar.occurred_at,
        'learner_id', ar.learner_id,
        'learner_name', ar.learner_name,
        'event_type', ar.event_type,
        'label', ar.label,
        'course_id', ar.course_id,
        'course_title', ar.course_title
      )
      order by ar.occurred_at desc
    ) as recent_activity
  from activity_ranked ar
  where ar.rn <= 10
  group by ar.local_id
),
last_activity as (
  select
    l.local_id,
    l.user_id,
    greatest(max(c.completed_at), max(q.submitted_at)) as last_activity_at
  from learners l
  left join completions c
    on c.local_id = l.local_id
   and c.user_id = l.user_id
  left join quiz_submits q
    on q.local_id = l.local_id
   and q.user_id = l.user_id
  group by l.local_id, l.user_id
),
alerts_base as (
  select
    la.local_id,
    la.user_id as learner_id,
    coalesce(p.full_name, p.email) as learner_name,
    la.last_activity_at,
    coalesce(
      floor(extract(epoch from (now() - la.last_activity_at)) / 86400),
      9999
    )::int as days_inactive
  from last_activity la
  left join public.profiles p on p.user_id = la.user_id
  where la.last_activity_at is null
     or la.last_activity_at < now() - interval '14 days'
),
alerts_ranked as (
  select
    ab.*,
    case
      when ab.days_inactive > 21 then 'danger'
      else 'warning'
    end as severity,
    row_number() over (
      partition by ab.local_id
      order by ab.days_inactive desc
    ) as rn
  from alerts_base ab
),
alerts_json as (
  select
    ar.local_id,
    jsonb_agg(
      jsonb_build_object(
        'type', 'inactive',
        'severity', ar.severity,
        'learner_id', ar.learner_id,
        'learner_name', ar.learner_name,
        'message', 'Sin actividad hace ' || ar.days_inactive || ' días',
        'metric_value', ar.days_inactive,
        'last_activity_at', ar.last_activity_at
      )
      order by ar.days_inactive desc
    ) as alerts
  from alerts_ranked ar
  where ar.rn <= 5
  group by ar.local_id
)
select
  lc.local_id,
  lc.local_name,
  greatest(
    coalesce(cc.max_completed_at, now()),
    coalesce(qc.max_submitted_at, now())
  ) as as_of,
  case
    when coalesce(lc2.learners_count, 0) * coalesce(lc3.total_lessons, 0) = 0 then 0
    else round(
      100.0 * coalesce(cc.completed_lessons, 0)
      / nullif(coalesce(lc2.learners_count, 0) * coalesce(lc3.total_lessons, 0), 0)
    )::int
  end as health_percent,
  null::numeric as health_delta_percent,
  null::jsonb as health_series,
  coalesce(lc2.learners_count, 0) as learners_count,
  coalesce(lc2.learners_new_count, 0) as learners_new_count,
  coalesce(cc2.active_courses_count, 0) as active_courses_count,
  case
    when coalesce(lc2.learners_count, 0) * coalesce(lc3.total_lessons, 0) = 0 then 0
    else round(
      100.0 * coalesce(cc.completed_lessons, 0)
      / nullif(coalesce(lc2.learners_count, 0) * coalesce(lc3.total_lessons, 0), 0)
    )::int
  end as completion_percent,
  null::numeric as completion_delta_percent,
  qc.avg_score as avg_score,
  null::text as avg_score_trend,
  coalesce(jsonb_array_length(aj.alerts), 0) as alerts_count,
  coalesce(aj.alerts, '[]'::jsonb) as alerts,
  coalesce(act.recent_activity, '[]'::jsonb) as recent_activity
from local_ctx lc
left join learner_counts lc2 on lc2.local_id = lc.local_id
left join course_counts cc2 on cc2.local_id = lc.local_id
left join lesson_counts lc3 on lc3.local_id = lc.local_id
left join completion_counts cc on cc.local_id = lc.local_id
left join quiz_counts qc on qc.local_id = lc.local_id
left join activity_json act on act.local_id = lc.local_id
left join alerts_json aj on aj.local_id = lc.local_id;

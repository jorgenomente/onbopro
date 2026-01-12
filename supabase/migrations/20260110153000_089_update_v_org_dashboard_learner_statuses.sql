create or replace view public.v_org_dashboard as
with org_access as (
  select o.id as org_id
  from public.organizations o
  where public.rls_is_superadmin()
     or public.rls_is_org_admin(o.id)
),
locals_base as (
  select
    l.id as local_id,
    l.org_id,
    l.name as local_name,
    l.archived_at,
    l.id::text as local_code
  from public.locals l
  join org_access oa on oa.org_id = l.org_id
),
learners as (
  select lm.local_id, lm.user_id
  from public.local_memberships lm
  join locals_base lb on lb.local_id = lm.local_id
  where lm.status = 'active'
    and lm.role = 'aprendiz'
),
learners_count as (
  select local_id, count(*)::int as learners_count
  from learners
  group by local_id
),
referentes_count as (
  select lm.local_id, count(*)::int as referentes_count
  from public.local_memberships lm
  join locals_base lb on lb.local_id = lm.local_id
  where lm.status = 'active'
    and lm.role = 'referente'
  group by lm.local_id
),
active_courses_count as (
  select lc.local_id, count(*)::int as active_courses_count
  from public.local_courses lc
  join locals_base lb on lb.local_id = lc.local_id
  where lc.status = 'active'
  group by lc.local_id
),
assigned_lessons as (
  select lb.local_id, l.id as lesson_id
  from locals_base lb
  join public.local_courses lc
    on lc.local_id = lb.local_id
   and lc.status = 'active'
  join public.course_units cu on cu.course_id = lc.course_id
  join public.lessons l on l.unit_id = cu.id
),
lessons_count as (
  select local_id, count(distinct lesson_id)::int as total_lessons
  from assigned_lessons
  group by local_id
),
learner_completion as (
  select
    ln.local_id,
    ln.user_id,
    count(distinct case when al.lesson_id is not null then lc.lesson_id end)::int
      as completed_lessons,
    max(case when al.lesson_id is not null then lc.completed_at end)
      as last_completion_at
  from learners ln
  left join public.lesson_completions lc
    on lc.local_id = ln.local_id
   and lc.user_id = ln.user_id
  left join assigned_lessons al
    on al.local_id = ln.local_id
   and al.lesson_id = lc.lesson_id
  group by ln.local_id, ln.user_id
),
quiz_submits_per_learner as (
  select qa.local_id, qa.user_id, max(qa.submitted_at) as last_quiz_submit_at
  from public.quiz_attempts qa
  join learners ln
    on ln.local_id = qa.local_id
   and ln.user_id = qa.user_id
  where qa.submitted_at is not null
  group by qa.local_id, qa.user_id
),
learner_progress as (
  select
    ln.local_id,
    ln.user_id,
    coalesce(lc2.total_lessons, 0) as total_lessons,
    coalesce(lc.completed_lessons, 0) as completed_lessons,
    greatest(lc.last_completion_at, ql.last_quiz_submit_at) as last_activity_at
  from learners ln
  left join lessons_count lc2 on lc2.local_id = ln.local_id
  left join learner_completion lc
    on lc.local_id = ln.local_id
   and lc.user_id = ln.user_id
  left join quiz_submits_per_learner ql
    on ql.local_id = ln.local_id
   and ql.user_id = ln.user_id
),
learner_state as (
  select
    lp.*,
    case
      when lp.total_lessons = 0 then null
      when lp.completed_lessons >= lp.total_lessons then 'completed'
      when lp.last_activity_at is null and lp.completed_lessons = 0 then 'not_started'
      when lp.last_activity_at < now() - interval '14 days' then 'at_risk'
      else 'in_progress'
    end as learner_status
  from learner_progress lp
),
local_metrics as (
  select
    lb.org_id,
    lb.local_id,
    lb.local_name,
    lb.local_code,
    lb.archived_at,
    coalesce(lc.learners_count, 0) as learners_count,
    coalesce(rc.referentes_count, 0) as referentes_count,
    coalesce(ac.active_courses_count, 0) as active_courses_count,
    coalesce(lc2.total_lessons, 0) as total_lessons,
    coalesce(sum(ls.completed_lessons), 0) as completed_lessons,
    max(ls.last_activity_at) as last_activity_at,
    count(*) filter (where ls.learner_status = 'at_risk')::int as risk_learners_count,
    count(*) filter (where ls.learner_status = 'in_progress')::int as in_progress_learners_count,
    count(*) filter (where ls.learner_status = 'completed')::int as completed_learners_count,
    count(*) filter (where ls.learner_status = 'not_started')::int as not_started_learners_count
  from locals_base lb
  left join learners_count lc on lc.local_id = lb.local_id
  left join referentes_count rc on rc.local_id = lb.local_id
  left join active_courses_count ac on ac.local_id = lb.local_id
  left join lessons_count lc2 on lc2.local_id = lb.local_id
  left join learner_state ls on ls.local_id = lb.local_id
  group by
    lb.org_id,
    lb.local_id,
    lb.local_name,
    lb.local_code,
    lb.archived_at,
    lc.learners_count,
    rc.referentes_count,
    ac.active_courses_count,
    lc2.total_lessons
),
local_status as (
  select
    lm.*,
    case
      when lm.archived_at is not null then 'inactive'
      when lm.learners_count > 0
        and lm.active_courses_count > 0
        and lm.last_activity_at is null then 'not_started'
      when lm.risk_learners_count > 0 then 'at_risk'
      when lm.learners_count > 0
        and lm.active_courses_count > 0
        and lm.completed_learners_count = lm.learners_count then 'completed'
      else 'in_progress'
    end as status,
    case
      when lm.archived_at is not null then null
      when lm.risk_learners_count > 0 then 'stalled_learners'
      when lm.learners_count > 0
        and lm.active_courses_count > 0
        and lm.last_activity_at is null then 'no_activity_yet'
      else null
    end as risk_reason,
    case
      when lm.archived_at is not null then null
      when lm.learners_count * lm.total_lessons = 0 then null
      else round(100.0 * lm.completed_lessons / nullif(lm.learners_count * lm.total_lessons, 0))::numeric
    end as completion_rate_pct
  from local_metrics lm
),
locals_json as (
  select
    ls.org_id,
    jsonb_agg(
      jsonb_build_object(
        'local_id', ls.local_id,
        'local_code', ls.local_code,
        'local_name', ls.local_name,
        'status', ls.status,
        'learners_count', ls.learners_count,
        'referentes_count', ls.referentes_count,
        'active_courses_count', ls.active_courses_count,
        'completion_rate_pct', ls.completion_rate_pct,
        'risk_reason', ls.risk_reason,
        'risk_learners_count', ls.risk_learners_count,
        'in_progress_learners_count', ls.in_progress_learners_count,
        'completed_learners_count', ls.completed_learners_count,
        'not_started_learners_count', ls.not_started_learners_count
      )
      order by
        case ls.status
          when 'at_risk' then 1
          when 'not_started' then 2
          when 'in_progress' then 3
          when 'completed' then 4
          else 5
        end,
        ls.completion_rate_pct asc nulls last,
        ls.local_name asc
    ) as locals
  from local_status ls
  group by ls.org_id
),
org_agg as (
  select
    oa.org_id,
    count(ls.local_id)::int as total_locals,
    count(ls.local_id) filter (where ls.status <> 'inactive')::int as active_locals,
    count(ls.local_id) filter (where ls.status = 'inactive')::int as inactive_locals,
    count(ls.local_id) filter (where ls.status = 'at_risk')::int as locals_at_risk,
    avg(ls.completion_rate_pct)::numeric as avg_engagement_pct
  from org_access oa
  left join local_status ls on ls.org_id = oa.org_id
  group by oa.org_id
)
select
  oa.org_id,
  coalesce(oa2.total_locals, 0) as total_locals,
  coalesce(oa2.active_locals, 0) as active_locals,
  coalesce(oa2.inactive_locals, 0) as inactive_locals,
  coalesce(oa2.avg_engagement_pct, 0)::numeric as avg_engagement_pct,
  coalesce(oa2.locals_at_risk, 0) as locals_at_risk,
  coalesce(lj.locals, '[]'::jsonb) as locals
from org_access oa
left join org_agg oa2 on oa2.org_id = oa.org_id
left join locals_json lj on lj.org_id = oa.org_id;

-- Sanity checks (manual)
-- select org_id, jsonb_array_length(locals) from public.v_org_dashboard;

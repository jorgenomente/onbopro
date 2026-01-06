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
completions as (
  select lc.local_id, lc.user_id, lc.lesson_id, lc.completed_at
  from public.lesson_completions lc
  join learners ln
    on ln.local_id = lc.local_id
   and ln.user_id = lc.user_id
  join assigned_lessons al
    on al.local_id = lc.local_id
   and al.lesson_id = lc.lesson_id
),
completion_counts as (
  select local_id, count(*)::int as completed_lessons, max(completed_at) as last_completion_at
  from completions
  group by local_id
),
quiz_submits as (
  select qa.local_id, qa.user_id, qa.submitted_at
  from public.quiz_attempts qa
  join learners ln
    on ln.local_id = qa.local_id
   and ln.user_id = qa.user_id
  where qa.submitted_at is not null
),
last_quiz_activity as (
  select local_id, max(submitted_at) as last_quiz_submit_at
  from quiz_submits
  group by local_id
),
local_activity as (
  select
    lb.local_id,
    greatest(cc.last_completion_at, lq.last_quiz_submit_at) as last_activity_at
  from locals_base lb
  left join completion_counts cc on cc.local_id = lb.local_id
  left join last_quiz_activity lq on lq.local_id = lb.local_id
),
local_metrics as (
  select
    lb.org_id,
    lb.local_id,
    lb.local_name,
    lb.local_code,
    lb.archived_at,
    coalesce(lc.learners_count, 0) as learners_count,
    coalesce(lc2.total_lessons, 0) as total_lessons,
    coalesce(cc.completed_lessons, 0) as completed_lessons,
    la.last_activity_at,
    case
      when lb.archived_at is not null then null
      when coalesce(lc.learners_count, 0) * coalesce(lc2.total_lessons, 0) = 0 then null
      else round(
        100.0 * coalesce(cc.completed_lessons, 0)
        / nullif(coalesce(lc.learners_count, 0) * coalesce(lc2.total_lessons, 0), 0)
      )::numeric
    end as completion_rate_pct
  from locals_base lb
  left join learners_count lc on lc.local_id = lb.local_id
  left join lessons_count lc2 on lc2.local_id = lb.local_id
  left join completion_counts cc on cc.local_id = lb.local_id
  left join local_activity la on la.local_id = lb.local_id
),
local_status as (
  select
    lm.*,
    case
      when lm.archived_at is not null then 'inactive'
      when lm.last_activity_at is null or lm.last_activity_at < now() - interval '21 days' then 'at_risk'
      when lm.completion_rate_pct is not null and lm.completion_rate_pct < 80 then 'at_risk'
      else 'on_track'
    end as status,
    case
      when lm.archived_at is not null then null
      when lm.completion_rate_pct is not null and lm.completion_rate_pct < 80 then 'low_completion'
      when lm.last_activity_at is null or lm.last_activity_at < now() - interval '21 days' then 'inactivity'
      else null
    end as risk_reason
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
        'completion_rate_pct', ls.completion_rate_pct,
        'risk_reason', ls.risk_reason
      )
      order by
        case ls.status when 'at_risk' then 1 when 'on_track' then 2 else 3 end,
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

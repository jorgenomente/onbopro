create or replace view public.v_org_local_detail as
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
  select
    lm.local_id,
    lm.user_id as learner_id,
    coalesce(p.full_name, p.email) as display_name
  from public.local_memberships lm
  join locals_base lb on lb.local_id = lm.local_id
  left join public.profiles p on p.user_id = lm.user_id
  where lm.status = 'active'
    and lm.role = 'aprendiz'
),
learners_count_local as (
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
total_lessons_local as (
  select local_id, count(distinct lesson_id)::int as total_lessons
  from assigned_lessons
  group by local_id
),
completions as (
  select
    lc.local_id,
    lc.user_id as learner_id,
    lc.lesson_id,
    lc.completed_at
  from public.lesson_completions lc
  join learners l
    on l.local_id = lc.local_id
   and l.learner_id = lc.user_id
  join assigned_lessons al
    on al.local_id = lc.local_id
   and al.lesson_id = lc.lesson_id
),
completion_counts as (
  select
    local_id,
    learner_id,
    count(*)::int as completed_lessons,
    max(completed_at) as last_completion_at
  from completions
  group by local_id, learner_id
),
completion_counts_local as (
  select
    local_id,
    count(*)::int as completed_lessons,
    max(completed_at) as last_completion_at
  from completions
  group by local_id
),
quiz_submits as (
  select
    qa.local_id,
    qa.user_id as learner_id,
    qa.submitted_at
  from public.quiz_attempts qa
  join learners l
    on l.local_id = qa.local_id
   and l.learner_id = qa.user_id
  join public.local_courses lc
    on lc.local_id = qa.local_id
   and lc.course_id = qa.course_id
   and lc.status = 'active'
  where qa.submitted_at is not null
),
quiz_activity as (
  select local_id, learner_id, max(submitted_at) as last_quiz_submit_at
  from quiz_submits
  group by local_id, learner_id
),
quiz_activity_local as (
  select local_id, max(submitted_at) as last_quiz_submit_at
  from quiz_submits
  group by local_id
),
learner_activity as (
  select
    l.local_id,
    l.learner_id,
    greatest(cc.last_completion_at, qa.last_quiz_submit_at) as last_activity_at
  from learners l
  left join completion_counts cc
    on cc.local_id = l.local_id
   and cc.learner_id = l.learner_id
  left join quiz_activity qa
    on qa.local_id = l.local_id
   and qa.learner_id = l.learner_id
),
learner_progress as (
  select
    l.local_id,
    l.learner_id,
    l.display_name,
    la.last_activity_at,
    coalesce(cc.completed_lessons, 0) as completed_lessons,
    coalesce(tl.total_lessons, 0) as total_lessons,
    case
      when coalesce(tl.total_lessons, 0) = 0 then null
      else round(
        100.0 * coalesce(cc.completed_lessons, 0)
        / nullif(tl.total_lessons, 0)
      )::numeric
    end as progress_pct,
    case
      when coalesce(tl.total_lessons, 0) > 0
       and (
         case
           when coalesce(tl.total_lessons, 0) = 0 then null
           else round(
             100.0 * coalesce(cc.completed_lessons, 0)
             / nullif(tl.total_lessons, 0)
           )::numeric
         end
       ) = 100 then 'completed'
      when la.last_activity_at is null
        or la.last_activity_at < now() - interval '14 days' then 'at_risk'
      else 'active'
    end as status
  from learners l
  left join completion_counts cc
    on cc.local_id = l.local_id
   and cc.learner_id = l.learner_id
  left join total_lessons_local tl
    on tl.local_id = l.local_id
  left join learner_activity la
    on la.local_id = l.local_id
   and la.learner_id = l.learner_id
),
learners_json as (
  select
    lp.local_id,
    jsonb_agg(
      jsonb_build_object(
        'learner_id', lp.learner_id,
        'display_name', lp.display_name,
        'avatar_url', null,
        'status', lp.status,
        'progress_pct', lp.progress_pct,
        'last_activity_at', lp.last_activity_at
      )
      order by
        case lp.status when 'at_risk' then 1 when 'active' then 2 else 3 end,
        lp.progress_pct asc nulls last,
        lp.display_name asc
    ) as learners
  from learner_progress lp
  group by lp.local_id
),
local_metrics as (
  select
    lb.org_id,
    lb.local_id,
    lb.local_name,
    lb.local_code,
    lb.archived_at,
    coalesce(lc.learners_count, 0) as learners_active_count,
    coalesce(
      (
        select count(*)
        from learner_progress lp
        where lp.local_id = lb.local_id
          and lp.status = 'at_risk'
      ),
      0
    )::int as learners_at_risk_count,
    case
      when lb.archived_at is not null then null
      when coalesce(tl.total_lessons, 0) = 0 then null
      else round(
        100.0 * coalesce(cc.completed_lessons, 0)
        / nullif(coalesce(lc.learners_count, 0) * coalesce(tl.total_lessons, 0), 0)
      )::numeric
    end as completion_rate_pct,
    greatest(cc.last_completion_at, qal.last_quiz_submit_at) as last_activity_at
  from locals_base lb
  left join learners_count_local lc on lc.local_id = lb.local_id
  left join total_lessons_local tl on tl.local_id = lb.local_id
  left join completion_counts_local cc on cc.local_id = lb.local_id
  left join quiz_activity_local qal on qal.local_id = lb.local_id
),
local_status as (
  select
    lm.*,
    case
      when lm.archived_at is not null then 'inactive'
      when lm.last_activity_at is null or lm.last_activity_at < now() - interval '21 days' then 'at_risk'
      when lm.completion_rate_pct is not null and lm.completion_rate_pct < 80 then 'at_risk'
      else 'on_track'
    end as local_status
  from local_metrics lm
)
select
  ls.org_id,
  ls.local_id,
  ls.local_name,
  ls.local_code,
  ls.local_status,
  ls.learners_active_count,
  ls.learners_at_risk_count,
  ls.completion_rate_pct,
  coalesce(lj.learners, '[]'::jsonb) as learners
from local_status ls
left join learners_json lj on lj.local_id = ls.local_id;

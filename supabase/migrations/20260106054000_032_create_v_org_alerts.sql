create or replace view public.v_org_alerts as
with org_access as (
  select o.id as org_id
  from public.organizations o
  where public.rls_is_superadmin()
     or public.rls_is_org_admin(o.id)
),
learner_base as (
  select
    ld.org_id,
    ld.learner_id,
    ld.learner_name,
    ld.last_activity_at,
    ld.overall_progress_pct as progress_pct
  from public.v_org_learner_detail ld
  join org_access oa on oa.org_id = ld.org_id
),
learner_locals as (
  select
    lm.org_id,
    lm.user_id as learner_id,
    l.id as local_id,
    l.name as local_name,
    row_number() over (
      partition by lm.org_id, lm.user_id
      order by l.name asc
    ) as rn
  from public.local_memberships lm
  join org_access oa on oa.org_id = lm.org_id
  join public.locals l on l.id = lm.local_id
  where lm.status = 'active'
    and lm.role = 'aprendiz'
),
primary_local as (
  select
    ll.org_id,
    ll.learner_id,
    ll.local_id,
    ll.local_name
  from learner_locals ll
  where ll.rn = 1
),
quiz_failures as (
  select
    qa.org_id,
    qa.user_id as learner_id,
    qa.quiz_id,
    count(*)::int as failed_count
  from public.quiz_attempts qa
  join org_access oa on oa.org_id = qa.org_id
  where qa.submitted_at is not null
    and qa.passed = false
  group by qa.org_id, qa.user_id, qa.quiz_id
),
quiz_failure_max as (
  select
    qf.org_id,
    qf.learner_id,
    max(qf.failed_count)::int as max_failed_count
  from quiz_failures qf
  group by qf.org_id, qf.learner_id
),
alert_base as (
  select
    lb.org_id,
    lb.learner_id,
    lb.learner_name,
    pl.local_id,
    pl.local_name,
    lb.last_activity_at,
    lb.progress_pct,
    qfm.max_failed_count,
    case
      when qfm.max_failed_count >= 3 then 'quiz_failed'
      when lb.last_activity_at is null
        or lb.last_activity_at < now() - interval '14 days' then 'inactive'
      when lb.progress_pct is not null and lb.progress_pct < 30 then 'low_progress'
      else null
    end as alert_type
  from learner_base lb
  join primary_local pl
    on pl.org_id = lb.org_id
   and pl.learner_id = lb.learner_id
  left join quiz_failure_max qfm
    on qfm.org_id = lb.org_id
   and qfm.learner_id = lb.learner_id
)
select
  ab.org_id,
  ab.learner_id,
  ab.learner_name,
  ab.local_id,
  ab.local_name,
  ab.alert_type,
  case
    when ab.alert_type = 'quiz_failed' then 'critical'
    when ab.alert_type in ('inactive', 'low_progress') then 'at_risk'
    else null
  end as alert_severity,
  case ab.alert_type
    when 'quiz_failed' then 'Reprobó evaluaciones'
    when 'inactive' then 'Sin actividad'
    when 'low_progress' then 'Progreso bajo'
    else null
  end as alert_label,
  case ab.alert_type
    when 'quiz_failed' then 'Falló el mismo quiz 3 o más veces.'
    when 'inactive' then 'Sin actividad en los últimos 14 días.'
    when 'low_progress' then 'Progreso por debajo de 30%.'
    else null
  end as alert_description,
  case
    when ab.alert_type = 'inactive' and ab.last_activity_at is not null
    then floor(extract(epoch from (now() - ab.last_activity_at)) / 86400)::int
    else null
  end as days_inactive,
  ab.progress_pct as progress_pct,
  case
    when ab.alert_type = 'quiz_failed' then ab.max_failed_count
    else null
  end as failed_quiz_count,
  ab.last_activity_at
from alert_base ab
where ab.alert_type is not null;

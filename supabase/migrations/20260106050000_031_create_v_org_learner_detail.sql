create or replace view public.v_org_learner_detail as
with org_access as (
  select o.id as org_id
  from public.organizations o
  where public.rls_is_superadmin()
     or public.rls_is_org_admin(o.id)
),
learner_base as (
  select
    lm.org_id,
    lm.user_id as learner_id,
    coalesce(p.full_name, p.email) as learner_name
  from public.local_memberships lm
  join org_access oa on oa.org_id = lm.org_id
  left join public.profiles p on p.user_id = lm.user_id
  where lm.status = 'active'
    and lm.role = 'aprendiz'
  group by lm.org_id, lm.user_id, p.full_name, p.email
),
learner_locals as (
  select
    lm.org_id,
    lm.user_id as learner_id,
    l.id as local_id,
    l.name as local_name
  from public.local_memberships lm
  join org_access oa on oa.org_id = lm.org_id
  join public.locals l on l.id = lm.local_id
  where lm.status = 'active'
    and lm.role = 'aprendiz'
),
locals_json as (
  select
    ll.org_id,
    ll.learner_id,
    jsonb_agg(
      jsonb_build_object(
        'local_id', ll.local_id,
        'local_name', ll.local_name
      )
      order by ll.local_name asc
    ) as locals
  from learner_locals ll
  group by ll.org_id, ll.learner_id
),
assigned_courses as (
  select
    ll.org_id,
    ll.learner_id,
    lc.course_id,
    min(lc.assigned_at) as assigned_at,
    c.title as course_title
  from learner_locals ll
  join public.local_courses lc
    on lc.local_id = ll.local_id
   and lc.status = 'active'
  join public.courses c on c.id = lc.course_id
  group by ll.org_id, ll.learner_id, lc.course_id, c.title
),
course_lessons as (
  select c.id as course_id, count(l.id)::int as total_lessons
  from public.courses c
  join public.course_units cu on cu.course_id = c.id
  join public.lessons l on l.unit_id = cu.id
  group by c.id
),
assigned_lessons as (
  select ac.org_id, ac.learner_id, ac.course_id, l.id as lesson_id
  from assigned_courses ac
  join public.course_units cu on cu.course_id = ac.course_id
  join public.lessons l on l.unit_id = cu.id
),
completion_by_course as (
  select
    al.org_id,
    al.learner_id,
    al.course_id,
    count(lc.lesson_id)::int as completed_lessons,
    max(lc.completed_at) as last_completion_at
  from assigned_lessons al
  left join public.lesson_completions lc
    on lc.lesson_id = al.lesson_id
   and lc.user_id = al.learner_id
  group by al.org_id, al.learner_id, al.course_id
),
completion_global as (
  select
    al.org_id,
    al.learner_id,
    count(distinct al.lesson_id)::int as total_lessons,
    count(lc.lesson_id)::int as completed_lessons,
    max(lc.completed_at) as last_completion_at
  from assigned_lessons al
  left join public.lesson_completions lc
    on lc.lesson_id = al.lesson_id
   and lc.user_id = al.learner_id
  group by al.org_id, al.learner_id
),
quiz_submits as (
  select
    qa.user_id as learner_id,
    qa.quiz_id,
    qa.course_id,
    qa.score,
    qa.passed,
    qa.submitted_at,
    qa.id as attempt_id
  from public.quiz_attempts qa
  where qa.submitted_at is not null
),
quiz_submits_scoped as (
  select
    ac.org_id,
    ac.learner_id,
    qs.quiz_id,
    qs.course_id,
    qs.score,
    qs.passed,
    qs.submitted_at,
    qs.attempt_id
  from assigned_courses ac
  join quiz_submits qs
    on qs.course_id = ac.course_id
   and qs.learner_id = ac.learner_id
),
last_quiz as (
  select
    qs.*,
    q.title as quiz_title,
    row_number() over (
      partition by qs.org_id, qs.learner_id, qs.quiz_id
      order by qs.submitted_at desc
    ) as rn
  from quiz_submits_scoped qs
  join public.quizzes q on q.id = qs.quiz_id
),
quizzes_json as (
  select
    lq.org_id,
    lq.learner_id,
    jsonb_agg(
      jsonb_build_object(
        'quiz_id', lq.quiz_id,
        'quiz_title', lq.quiz_title,
        'score_pct', lq.score,
        'passed', lq.passed,
        'last_attempt_at', lq.submitted_at
      )
      order by lq.submitted_at desc
    ) as quizzes
  from last_quiz lq
  where lq.rn = 1
  group by lq.org_id, lq.learner_id
),
quiz_counts as (
  select
    qs.org_id,
    qs.learner_id,
    count(*) filter (where qs.passed = true)::int as quizzes_passed_count,
    count(*) filter (where qs.passed = false)::int as quizzes_failed_count
  from quiz_submits_scoped qs
  group by qs.org_id, qs.learner_id
),
incorrect_topics as (
  select
    qs.org_id,
    qs.learner_id,
    q.title as topic,
    count(*)::int as incorrect_count
  from quiz_submits_scoped qs
  join public.quiz_attempts qa on qa.id = qs.attempt_id
  join public.quiz_answers qans on qans.attempt_id = qa.id
  left join public.quiz_options qo on qo.id = qans.option_id
  join public.quizzes q on q.id = qs.quiz_id
  where qo.is_correct = false
  group by qs.org_id, qs.learner_id, q.title
),
top_incorrect_topics as (
  select
    it.org_id,
    it.learner_id,
    jsonb_agg(
      jsonb_build_object(
        'topic', it.topic,
        'incorrect_count', it.incorrect_count
      )
      order by it.incorrect_count desc
    ) as top_incorrect_topics
  from (
    select
      it.*,
      row_number() over (
        partition by it.org_id, it.learner_id
        order by it.incorrect_count desc
      ) as rn
    from incorrect_topics it
  ) it
  where it.rn <= 5
  group by it.org_id, it.learner_id
),
courses_json as (
  select
    ac.org_id,
    ac.learner_id,
    jsonb_agg(
      jsonb_build_object(
        'course_id', ac.course_id,
        'course_title', ac.course_title,
        'status',
          case
            when coalesce(cl.total_lessons, 0) > 0
             and coalesce(cb.completed_lessons, 0) = coalesce(cl.total_lessons, 0) then 'completed'
            when coalesce(cb.completed_lessons, 0) = 0 then 'pending'
            else 'in_progress'
          end,
        'progress_pct',
          case
            when coalesce(cl.total_lessons, 0) = 0 then null
            else round(
              100.0 * coalesce(cb.completed_lessons, 0)
              / nullif(cl.total_lessons, 0)
            )::numeric
          end,
        'assigned_at', ac.assigned_at,
        'completed_at',
          case
            when coalesce(cl.total_lessons, 0) > 0
             and coalesce(cb.completed_lessons, 0) = coalesce(cl.total_lessons, 0)
            then cb.last_completion_at
            else null
          end
      )
      order by
        case
          when coalesce(cb.completed_lessons, 0) = 0 then 1
          when coalesce(cl.total_lessons, 0) > 0
           and coalesce(cb.completed_lessons, 0) = coalesce(cl.total_lessons, 0) then 3
          else 2
        end,
        coalesce(
          case
            when coalesce(cl.total_lessons, 0) = 0 then null
            else round(
              100.0 * coalesce(cb.completed_lessons, 0)
              / nullif(cl.total_lessons, 0)
            )::numeric
          end,
          0
        ) asc
    ) as courses
  from assigned_courses ac
  left join course_lessons cl on cl.course_id = ac.course_id
  left join completion_by_course cb
    on cb.org_id = ac.org_id
   and cb.learner_id = ac.learner_id
   and cb.course_id = ac.course_id
  group by ac.org_id, ac.learner_id
),
recent_activity_base as (
  select
    ac.org_id,
    ac.learner_id,
    lc.completed_at as occurred_at,
    'lesson_completed'::text as event_type,
    'Completó una lección'::text as event_label
  from assigned_courses ac
  join public.lesson_completions lc
    on lc.user_id = ac.learner_id
   and lc.course_id = ac.course_id
  union all
  select
    qs.org_id,
    qs.learner_id,
    qs.submitted_at as occurred_at,
    'quiz_submitted'::text as event_type,
    'Envió una evaluación'::text as event_label
  from quiz_submits_scoped qs
),
recent_activity_ranked as (
  select
    rab.*,
    row_number() over (
      partition by rab.org_id, rab.learner_id
      order by rab.occurred_at desc
    ) as rn
  from recent_activity_base rab
),
recent_activity_json as (
  select
    ra.org_id,
    ra.learner_id,
    jsonb_agg(
      jsonb_build_object(
        'event_type', ra.event_type,
        'event_label', ra.event_label,
        'occurred_at', ra.occurred_at
      )
      order by ra.occurred_at desc
    ) as recent_activity
  from recent_activity_ranked ra
  where ra.rn <= 10
  group by ra.org_id, ra.learner_id
),
last_activity as (
  select
    lb.org_id,
    lb.learner_id,
    greatest(cg.last_completion_at, max(qs.submitted_at)) as last_activity_at
  from learner_base lb
  left join completion_global cg
    on cg.org_id = lb.org_id
   and cg.learner_id = lb.learner_id
  left join quiz_submits_scoped qs
    on qs.org_id = lb.org_id
   and qs.learner_id = lb.learner_id
  group by lb.org_id, lb.learner_id, cg.last_completion_at
),
overall_progress as (
  select
    cg.org_id,
    cg.learner_id,
    cg.total_lessons,
    cg.completed_lessons,
    case
      when cg.total_lessons = 0 then null
      else round(100.0 * cg.completed_lessons / nullif(cg.total_lessons, 0))::numeric
    end as overall_progress_pct
  from completion_global cg
)
select
  lb.org_id,
  lb.learner_id,
  lb.learner_name,
  case
    when op.overall_progress_pct = 100 then 'completed'
    when la.last_activity_at is null
      or la.last_activity_at < now() - interval '14 days' then 'at_risk'
    else 'active'
  end::text as learner_status,
  la.last_activity_at,
  coalesce(lj.locals, '[]'::jsonb) as locals,
  op.overall_progress_pct,
  coalesce((select count(*) from assigned_courses ac where ac.org_id = lb.org_id and ac.learner_id = lb.learner_id), 0)::int as courses_assigned_count,
  coalesce(
    (
      select count(*)
      from assigned_courses ac
      join course_lessons cl on cl.course_id = ac.course_id
      join completion_by_course cb
        on cb.org_id = ac.org_id
       and cb.learner_id = ac.learner_id
       and cb.course_id = ac.course_id
      where ac.org_id = lb.org_id
        and ac.learner_id = lb.learner_id
        and coalesce(cl.total_lessons, 0) > 0
        and coalesce(cb.completed_lessons, 0) = coalesce(cl.total_lessons, 0)
    ),
    0
  )::int as courses_completed_count,
  coalesce(qc.quizzes_passed_count, 0) as quizzes_passed_count,
  coalesce(qc.quizzes_failed_count, 0) as quizzes_failed_count,
  coalesce(ti.top_incorrect_topics, '[]'::jsonb) as top_incorrect_topics,
  coalesce(cj.courses, '[]'::jsonb) as courses,
  coalesce(qj.quizzes, '[]'::jsonb) as quizzes,
  coalesce(rj.recent_activity, '[]'::jsonb) as recent_activity
from learner_base lb
left join locals_json lj
  on lj.org_id = lb.org_id
 and lj.learner_id = lb.learner_id
left join overall_progress op
  on op.org_id = lb.org_id
 and op.learner_id = lb.learner_id
left join quiz_counts qc
  on qc.org_id = lb.org_id
 and qc.learner_id = lb.learner_id
left join top_incorrect_topics ti
  on ti.org_id = lb.org_id
 and ti.learner_id = lb.learner_id
left join courses_json cj
  on cj.org_id = lb.org_id
 and cj.learner_id = lb.learner_id
left join quizzes_json qj
  on qj.org_id = lb.org_id
 and qj.learner_id = lb.learner_id
left join recent_activity_json rj
  on rj.org_id = lb.org_id
 and rj.learner_id = lb.learner_id
left join last_activity la
  on la.org_id = lb.org_id
 and la.learner_id = lb.learner_id;

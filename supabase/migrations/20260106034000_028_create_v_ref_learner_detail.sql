create or replace view public.v_ref_learner_detail as
with ref_access as (
  select lm.local_id
  from public.local_memberships lm
  where lm.user_id = auth.uid()
    and lm.status = 'active'
    and lm.role = 'referente'
),
learner_ctx as (
  select
    lm.local_id,
    lm.user_id as learner_id,
    lm.status::text as membership_status,
    lm.created_at as membership_created_at,
    coalesce(p.full_name, p.email) as learner_name,
    p.email as learner_email,
    l.name as local_name
  from public.local_memberships lm
  join ref_access ra on ra.local_id = lm.local_id
  join public.locals l on l.id = lm.local_id
  left join public.profiles p on p.user_id = lm.user_id
  where lm.status = 'active'
    and lm.role = 'aprendiz'
),
assigned_courses as (
  select lc.local_id, lc.course_id, c.title as course_title
  from public.local_courses lc
  join ref_access ra on ra.local_id = lc.local_id
  join public.courses c on c.id = lc.course_id
  where lc.status = 'active'
),
assigned_lessons as (
  select
    ac.local_id,
    ac.course_id,
    cu.id as unit_id,
    cu.title as unit_title,
    l.id as lesson_id
  from assigned_courses ac
  join public.course_units cu on cu.course_id = ac.course_id
  join public.lessons l on l.unit_id = cu.id
),
course_totals as (
  select al.local_id, al.course_id, count(distinct al.lesson_id)::int as total_lessons
  from assigned_lessons al
  group by al.local_id, al.course_id
),
total_lessons_local as (
  select al.local_id, count(distinct al.lesson_id)::int as total_lessons
  from assigned_lessons al
  group by al.local_id
),
completions as (
  select
    lc.local_id,
    lc.user_id as learner_id,
    lc.lesson_id,
    lc.course_id,
    lc.completed_at
  from public.lesson_completions lc
  join learner_ctx l
    on l.local_id = lc.local_id
   and l.learner_id = lc.user_id
  join assigned_lessons al
    on al.local_id = lc.local_id
   and al.lesson_id = lc.lesson_id
),
completions_by_course as (
  select
    c.local_id,
    c.learner_id,
    c.course_id,
    count(*)::int as completed_lessons,
    max(c.completed_at) as last_completion_at
  from completions c
  group by c.local_id, c.learner_id, c.course_id
),
completions_global as (
  select
    c.local_id,
    c.learner_id,
    count(*)::int as completed_lessons,
    max(c.completed_at) as last_completion_at
  from completions c
  group by c.local_id, c.learner_id
),
quiz_submits as (
  select
    qa.local_id,
    qa.user_id as learner_id,
    qa.quiz_id,
    qa.course_id,
    qa.attempt_no,
    qa.score,
    qa.passed,
    qa.submitted_at,
    qa.id as attempt_id
  from public.quiz_attempts qa
  join learner_ctx l
    on l.local_id = qa.local_id
   and l.learner_id = qa.user_id
  join public.local_courses lc
    on lc.local_id = qa.local_id
   and lc.course_id = qa.course_id
   and lc.status = 'active'
  where qa.submitted_at is not null
),
quiz_by_course as (
  select
    qs.local_id,
    qs.learner_id,
    qs.course_id,
    max(qs.submitted_at) as last_quiz_submit_at
  from quiz_submits qs
  group by qs.local_id, qs.learner_id, qs.course_id
),
avg_score_global as (
  select qs.local_id, qs.learner_id, avg(qs.score)::numeric as avg_score,
         max(qs.submitted_at) as last_quiz_submit_at
  from quiz_submits qs
  group by qs.local_id, qs.learner_id
),
last_activity_global as (
  select
    l.local_id,
    l.learner_id,
    greatest(cg.last_completion_at, ag.last_quiz_submit_at) as last_activity_at
  from learner_ctx l
  left join completions_global cg
    on cg.local_id = l.local_id
   and cg.learner_id = l.learner_id
  left join avg_score_global ag
    on ag.local_id = l.local_id
   and ag.learner_id = l.learner_id
),
courses_json as (
  select
    l.local_id,
    l.learner_id,
    jsonb_agg(
      jsonb_build_object(
        'course_id', ac.course_id,
        'course_title', ac.course_title,
        'course_status',
          case
            when coalesce(ct.total_lessons, 0) > 0
             and coalesce(cc.completed_lessons, 0) = coalesce(ct.total_lessons, 0) then 'completed'
            when coalesce(cc.completed_lessons, 0) = 0 then 'pending'
            else 'in_progress'
          end,
        'completion_percent',
          case
            when coalesce(ct.total_lessons, 0) = 0 then 0
            else round(
              100.0 * coalesce(cc.completed_lessons, 0)
              / nullif(ct.total_lessons, 0)
            )::int
          end,
        'completed_lessons', coalesce(cc.completed_lessons, 0),
        'total_lessons', coalesce(ct.total_lessons, 0),
        'last_activity_at', greatest(cc.last_completion_at, qb.last_quiz_submit_at)
      )
      order by ac.course_title asc
    ) as courses
  from learner_ctx l
  join assigned_courses ac on ac.local_id = l.local_id
  left join course_totals ct
    on ct.local_id = ac.local_id
   and ct.course_id = ac.course_id
  left join completions_by_course cc
    on cc.local_id = ac.local_id
   and cc.course_id = ac.course_id
   and cc.learner_id = l.learner_id
  left join quiz_by_course qb
    on qb.local_id = ac.local_id
   and qb.course_id = ac.course_id
   and qb.learner_id = l.learner_id
  group by l.local_id, l.learner_id
),
recent_activity_base as (
  select
    lc.local_id,
    lc.user_id as learner_id,
    lc.completed_at as occurred_at,
    'lesson_completed'::text as event_type,
    'Completó una lección'::text as label,
    lc.course_id,
    c.title as course_title,
    cu.id as unit_id,
    cu.title as unit_title,
    null::uuid as quiz_id,
    null::text as quiz_title
  from public.lesson_completions lc
  join learner_ctx l
    on l.local_id = lc.local_id
   and l.learner_id = lc.user_id
  join public.courses c on c.id = lc.course_id
  join public.course_units cu on cu.id = lc.unit_id
  union all
  select
    qs.local_id,
    qs.learner_id,
    qs.submitted_at as occurred_at,
    'quiz_submitted'::text as event_type,
    'Finalizó examen'::text as label,
    qs.course_id,
    c.title as course_title,
    q.unit_id,
    cu.title as unit_title,
    q.id as quiz_id,
    q.title as quiz_title
  from quiz_submits qs
  join public.quizzes q on q.id = qs.quiz_id
  join public.courses c on c.id = qs.course_id
  left join public.course_units cu on cu.id = q.unit_id
),
recent_activity_ranked as (
  select
    rab.*,
    row_number() over (
      partition by rab.local_id, rab.learner_id
      order by rab.occurred_at desc
    ) as rn
  from recent_activity_base rab
),
recent_activity_json as (
  select
    ra.local_id,
    ra.learner_id,
    jsonb_agg(
      jsonb_build_object(
        'occurred_at', ra.occurred_at,
        'event_type', ra.event_type,
        'label', ra.label,
        'course_id', ra.course_id,
        'course_title', ra.course_title,
        'unit_id', ra.unit_id,
        'unit_title', ra.unit_title,
        'quiz_id', ra.quiz_id,
        'quiz_title', ra.quiz_title
      )
      order by ra.occurred_at desc
    ) as recent_activity
  from recent_activity_ranked ra
  where ra.rn <= 20
  group by ra.local_id, ra.learner_id
),
last_attempts as (
  select
    qs.local_id,
    qs.learner_id,
    qs.quiz_id,
    qs.course_id,
    qs.attempt_id,
    qs.attempt_no,
    qs.submitted_at,
    qs.score,
    qs.passed,
    q.title as quiz_title,
    q.unit_id,
    row_number() over (
      partition by qs.local_id, qs.learner_id, qs.quiz_id
      order by qs.submitted_at desc
    ) as rn
  from quiz_submits qs
  join public.quizzes q on q.id = qs.quiz_id
),
quiz_totals as (
  select qq.quiz_id, count(*)::int as total_questions
  from public.quiz_questions qq
  group by qq.quiz_id
),
incorrects_base as (
  select
    la.local_id,
    la.learner_id,
    la.quiz_id,
    qa.question_id,
    qq.position,
    qq.prompt,
    qa.option_id as selected_option_id,
    qo_sel.option_text as selected_option_text,
    qo_correct.id as correct_option_id,
    qo_correct.option_text as correct_option_text
  from last_attempts la
  join public.quiz_answers qa on qa.attempt_id = la.attempt_id
  join public.quiz_questions qq on qq.id = qa.question_id
  left join public.quiz_options qo_sel on qo_sel.id = qa.option_id
  left join public.quiz_options qo_correct
    on qo_correct.question_id = qq.id
   and qo_correct.is_correct = true
  where la.rn = 1
    and qa.option_id is not null
    and (qo_sel.is_correct = false or qo_sel.is_correct is null)
),
incorrects_ranked as (
  select
    ib.*,
    row_number() over (
      partition by ib.local_id, ib.learner_id, ib.quiz_id
      order by ib.position asc
    ) as rn
  from incorrects_base ib
),
incorrects_json as (
  select
    ir.local_id,
    ir.learner_id,
    ir.quiz_id,
    count(*)::int as incorrect_count,
    jsonb_agg(
      jsonb_build_object(
        'question_id', ir.question_id,
        'position', ir.position,
        'prompt', ir.prompt,
        'selected_option_id', ir.selected_option_id,
        'selected_option_text', ir.selected_option_text,
        'correct_option_id', ir.correct_option_id,
        'correct_option_text', ir.correct_option_text
      )
      order by ir.position asc
    ) as incorrect_questions
  from incorrects_ranked ir
  where ir.rn <= 5
  group by ir.local_id, ir.learner_id, ir.quiz_id
),
quizzes_json as (
  select
    la.local_id,
    la.learner_id,
    jsonb_agg(
      jsonb_build_object(
        'quiz_id', la.quiz_id,
        'quiz_title', la.quiz_title,
        'quiz_scope', case when la.unit_id is null then 'course' else 'unit' end,
        'course_id', la.course_id,
        'unit_id', la.unit_id,
        'last_attempt_id', la.attempt_id,
        'last_attempt_no', la.attempt_no,
        'last_submitted_at', la.submitted_at,
        'last_score', la.score,
        'last_passed', la.passed,
        'total_questions', coalesce(qt.total_questions, 0),
        'incorrect_count', coalesce(ij.incorrect_count, 0),
        'incorrect_questions', coalesce(ij.incorrect_questions, '[]'::jsonb)
      )
      order by la.submitted_at desc
    ) as quizzes
  from last_attempts la
  left join quiz_totals qt on qt.quiz_id = la.quiz_id
  left join incorrects_json ij
    on ij.local_id = la.local_id
   and ij.learner_id = la.learner_id
   and ij.quiz_id = la.quiz_id
  where la.rn = 1
  group by la.local_id, la.learner_id
)
select
  l.local_id,
  l.local_name,
  l.learner_id,
  l.learner_name,
  l.learner_email,
  l.membership_status,
  l.membership_created_at,
  case
    when coalesce(tl.total_lessons, 0) > 0
     and (
       case
         when coalesce(tl.total_lessons, 0) = 0 then 0
         else round(
           100.0 * coalesce(cg.completed_lessons, 0)
           / nullif(tl.total_lessons, 0)
         )::int
       end
     ) = 100 then 'graduated'
    when lag.last_activity_at is null
      or lag.last_activity_at < now() - interval '14 days' then 'inactive'
    else 'active'
  end::text as learner_state,
  case
    when lag.last_activity_at is null
      or lag.last_activity_at < now() - interval '21 days' then 'danger'
    when lag.last_activity_at < now() - interval '14 days' then 'warning'
    else 'none'
  end::text as risk_level,
  lag.last_activity_at,
  case
    when lag.last_activity_at is null then null
    else floor(extract(epoch from (now() - lag.last_activity_at)) / 86400)::int
  end as days_inactive,
  case
    when coalesce(tl.total_lessons, 0) = 0 then 0
    else round(
      100.0 * coalesce(cg.completed_lessons, 0)
      / nullif(tl.total_lessons, 0)
    )::int
  end as completion_percent,
  ag.avg_score,
  coalesce(cj.courses, '[]'::jsonb) as courses,
  coalesce(ra.recent_activity, '[]'::jsonb) as recent_activity,
  coalesce(qj.quizzes, '[]'::jsonb) as quizzes
from learner_ctx l
left join total_lessons_local tl
  on tl.local_id = l.local_id
left join completions_global cg
  on cg.local_id = l.local_id
 and cg.learner_id = l.learner_id
left join avg_score_global ag
  on ag.local_id = l.local_id
 and ag.learner_id = l.learner_id
left join last_activity_global lag
  on lag.local_id = l.local_id
 and lag.learner_id = l.learner_id
left join courses_json cj
  on cj.local_id = l.local_id
 and cj.learner_id = l.learner_id
left join recent_activity_json ra
  on ra.local_id = l.local_id
 and ra.learner_id = l.learner_id
left join quizzes_json qj
  on qj.local_id = l.local_id
 and qj.learner_id = l.learner_id;

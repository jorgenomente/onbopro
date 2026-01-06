-- Ensure learner views enforce local membership + active course assignment

create or replace view v_learner_dashboard_courses as
-- membresias activas del aprendiz
with memberships as (
  select lm.local_id
  from local_memberships lm
  where lm.user_id = auth.uid()
    and lm.status = 'active'
    and lm.role = 'aprendiz'
),
-- cursos asignados al local con status activo
assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  join memberships m on m.local_id = lc.local_id
  where lc.status = 'active'
),
-- total de lecciones por curso
course_lessons as (
  select cu.course_id, count(l.id) as total_lessons
  from course_units cu
  join lessons l on l.unit_id = cu.id
  group by cu.course_id
),
-- completions del usuario autenticado por local y curso
user_completions as (
  select lcpl.local_id,
         lcpl.course_id,
         count(*) as completed_lessons,
         max(lcpl.completed_at) as last_activity_at
  from lesson_completions lcpl
  where lcpl.user_id = auth.uid()
  group by lcpl.local_id, lcpl.course_id
),
-- primera unidad con al menos una leccion pendiente (por orden)
current_unit as (
  select ranked.local_id,
         ranked.course_id,
         ranked.unit_id,
         ranked.unit_title
  from (
    select a.local_id,
           cu.course_id,
           cu.id as unit_id,
           cu.title as unit_title,
           row_number() over (
             partition by a.local_id, cu.course_id
             order by cu.position
           ) as rn
    from assigned a
    join course_units cu on cu.course_id = a.course_id
    join lessons l on l.unit_id = cu.id
    left join lesson_completions lcpl
      on lcpl.lesson_id = l.id
     and lcpl.user_id = auth.uid()
     and lcpl.local_id = a.local_id
    group by a.local_id, cu.course_id, cu.id, cu.title, cu.position
    having count(l.id) > count(lcpl.id)
  ) ranked
  where ranked.rn = 1
)
select
  a.local_id,
  a.course_id,
  c.title as course_title,
  null::text as course_image_url,
  case
    when coalesce(cl.total_lessons, 0) = 0 then 'pending'
    when coalesce(uc.completed_lessons, 0) = 0 then 'pending'
    when uc.completed_lessons < cl.total_lessons then 'in_progress'
    else 'completed'
  end as course_status,
  coalesce(cl.total_lessons, 0) as total_lessons,
  coalesce(uc.completed_lessons, 0) as completed_lessons,
  case
    when coalesce(cl.total_lessons, 0) = 0 then 0
    else round((coalesce(uc.completed_lessons, 0)::numeric / nullif(cl.total_lessons, 0)) * 100)::int
  end as progress_percent,
  uc.last_activity_at,
  case
    when coalesce(cl.total_lessons, 0) > 0
      and uc.completed_lessons = cl.total_lessons
      then uc.last_activity_at
    else null
  end as completed_at,
  cu.unit_id as current_unit_id,
  cu.unit_title as current_unit_title,
  null::int as estimated_minutes_left
from assigned a
join courses c on c.id = a.course_id
left join course_lessons cl on cl.course_id = a.course_id
left join user_completions uc
  on uc.local_id = a.local_id
 and uc.course_id = a.course_id
left join current_unit cu
  on cu.local_id = a.local_id
 and cu.course_id = a.course_id;

create or replace view v_course_outline as
-- membresias activas del aprendiz
with memberships as (
  select lm.local_id
  from local_memberships lm
  where lm.user_id = auth.uid()
    and lm.status = 'active'
    and lm.role = 'aprendiz'
),
-- cursos asignados al local (status activo)
assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  join memberships m on m.local_id = lc.local_id
  where lc.status = 'active'
),
-- unidades + lecciones del curso
units_lessons as (
  select
    a.local_id,
    a.course_id,
    c.title as course_title,
    cu.id as unit_id,
    cu.title as unit_title,
    cu.position as unit_position,
    l.id as lesson_id,
    l.title as lesson_title,
    l.position as lesson_position
  from assigned a
  join courses c on c.id = a.course_id
  join course_units cu on cu.course_id = a.course_id
  join lessons l on l.unit_id = cu.id
),
-- completions del usuario autenticado por leccion
user_completions as (
  select
    lcpl.local_id,
    lcpl.course_id,
    lcpl.unit_id,
    lcpl.lesson_id,
    max(lcpl.completed_at) as completed_at
  from lesson_completions lcpl
  where lcpl.user_id = auth.uid()
  group by lcpl.local_id, lcpl.course_id, lcpl.unit_id, lcpl.lesson_id
),
-- marca la primera leccion no completada del curso
course_order as (
  select
    ul.local_id,
    ul.course_id,
    ul.unit_id,
    ul.lesson_id,
    row_number() over (
      partition by ul.local_id, ul.course_id
      order by ul.unit_position, ul.lesson_position
    ) as rn,
    case when uc.lesson_id is null then 1 else 0 end as is_pending
  from units_lessons ul
  left join user_completions uc
    on uc.local_id = ul.local_id
   and uc.course_id = ul.course_id
   and uc.lesson_id = ul.lesson_id
),
first_pending as (
  select ranked.local_id, ranked.course_id, ranked.lesson_id
  from (
    select
      co.local_id,
      co.course_id,
      co.lesson_id,
      row_number() over (
        partition by co.local_id, co.course_id
        order by co.rn
      ) as pending_rn
    from course_order co
    where co.is_pending = 1
  ) ranked
  where ranked.pending_rn = 1
),
-- agregados por unidad
unit_agg as (
  select
    ul.local_id,
    ul.course_id,
    ul.unit_id,
    count(ul.lesson_id) as unit_total_lessons,
    count(uc.lesson_id) as unit_completed_lessons
  from units_lessons ul
  left join user_completions uc
    on uc.local_id = ul.local_id
   and uc.course_id = ul.course_id
   and uc.unit_id = ul.unit_id
   and uc.lesson_id = ul.lesson_id
  group by ul.local_id, ul.course_id, ul.unit_id
),
-- agregados por curso
course_agg as (
  select
    ul.local_id,
    ul.course_id,
    count(distinct ul.unit_id) as total_units,
    count(ul.lesson_id) as total_lessons,
    count(uc.lesson_id) as completed_lessons
  from units_lessons ul
  left join user_completions uc
    on uc.local_id = ul.local_id
   and uc.course_id = ul.course_id
   and uc.lesson_id = ul.lesson_id
  group by ul.local_id, ul.course_id
)
select
  ul.local_id,
  ul.course_id,
  ul.course_title,
  null::text as course_image_url,
  ca.total_units,
  ca.total_lessons,
  ca.completed_lessons,
  case
    when coalesce(ca.total_lessons, 0) = 0 then 0
    else round((ca.completed_lessons::numeric / nullif(ca.total_lessons, 0)) * 100)::int
  end as progress_percent,
  ul.unit_id,
  ul.unit_title,
  ul.unit_position,
  ua.unit_total_lessons,
  ua.unit_completed_lessons,
  case
    when coalesce(ua.unit_total_lessons, 0) = 0 then 0
    else round((ua.unit_completed_lessons::numeric / nullif(ua.unit_total_lessons, 0)) * 100)::int
  end as unit_progress_percent,
  case
    when ua.unit_total_lessons > 0 and ua.unit_completed_lessons = ua.unit_total_lessons then 'completed'
    when ua.unit_completed_lessons = 0 then 'pending'
    when ua.unit_completed_lessons < ua.unit_total_lessons then 'in_progress'
    else 'pending'
  end as unit_status,
  ul.lesson_id,
  ul.lesson_title,
  ul.lesson_position,
  null::int as lesson_duration_minutes,
  case
    when uc.lesson_id is not null then 'completed'
    when fp.lesson_id is not null then 'in_progress'
    else 'pending'
  end as lesson_status,
  uc.completed_at as lesson_completed_at,
  qu_unit.id as unit_quiz_id,
  qu_final.id as course_quiz_id
from units_lessons ul
left join user_completions uc
  on uc.local_id = ul.local_id
 and uc.course_id = ul.course_id
 and uc.lesson_id = ul.lesson_id
left join first_pending fp
  on fp.local_id = ul.local_id
 and fp.course_id = ul.course_id
 and fp.lesson_id = ul.lesson_id
left join unit_agg ua
  on ua.local_id = ul.local_id
 and ua.course_id = ul.course_id
 and ua.unit_id = ul.unit_id
left join course_agg ca
  on ca.local_id = ul.local_id
 and ca.course_id = ul.course_id
left join quizzes qu_unit
  on qu_unit.type = 'unit'
 and qu_unit.unit_id = ul.unit_id
left join quizzes qu_final
  on qu_final.type = 'final'
 and qu_final.course_id = ul.course_id;

create or replace view v_lesson_player as
-- target lesson with unit + course
with target_lesson as (
  select
    l.id as lesson_id,
    l.title as lesson_title,
    l.position as lesson_position,
    l.content_type,
    l.content,
    cu.id as unit_id,
    cu.title as unit_title,
    cu.position as unit_position,
    c.id as course_id,
    c.title as course_title
  from lessons l
  join course_units cu on cu.id = l.unit_id
  join courses c on c.id = cu.course_id
),
-- membresias activas del aprendiz
memberships as (
  select lm.local_id
  from local_memberships lm
  where lm.user_id = auth.uid()
    and lm.status = 'active'
    and lm.role = 'aprendiz'
),
-- assigned courses for local
assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  join memberships m on m.local_id = lc.local_id
  where lc.status = 'active'
),
-- ordered lessons for navigation
ordered_lessons as (
  select
    a.local_id,
    tl.course_id,
    tl.unit_id,
    tl.lesson_id,
    row_number() over (
      partition by a.local_id, tl.course_id
      order by tl.unit_position, tl.lesson_position
    ) as rn
  from assigned a
  join target_lesson tl on tl.course_id = a.course_id
),
-- previous/next ids by row number
nav as (
  select
    ol.local_id,
    ol.course_id,
    ol.lesson_id,
    prev.lesson_id as prev_lesson_id,
    nxt.lesson_id as next_lesson_id
  from ordered_lessons ol
  left join ordered_lessons prev
    on prev.local_id = ol.local_id
   and prev.course_id = ol.course_id
   and prev.rn = ol.rn - 1
  left join ordered_lessons nxt
    on nxt.local_id = ol.local_id
   and nxt.course_id = ol.course_id
   and nxt.rn = ol.rn + 1
),
-- completion state for auth user
completion as (
  select
    lcpl.local_id,
    lcpl.lesson_id,
    lcpl.completed_at
  from lesson_completions lcpl
  where lcpl.user_id = auth.uid()
)
select
  a.local_id,
  tl.course_id,
  tl.course_title,
  null::text as course_image_url,
  tl.unit_id,
  tl.unit_title,
  tl.unit_position,
  tl.lesson_id,
  tl.lesson_title,
  tl.lesson_position,
  tl.content_type,
  tl.content,
  (comp.lesson_id is not null) as is_completed,
  comp.completed_at,
  (comp.lesson_id is null) as can_mark_complete,
  nav.prev_lesson_id,
  nav.next_lesson_id
from assigned a
join target_lesson tl
  on tl.course_id = a.course_id
join nav
  on nav.local_id = a.local_id
 and nav.course_id = tl.course_id
 and nav.lesson_id = tl.lesson_id
left join completion comp
  on comp.local_id = a.local_id
 and comp.lesson_id = tl.lesson_id;

create or replace view v_quiz_state as
-- quiz base with scope and course
with quiz_base as (
  select
    q.id as quiz_id,
    q.title as quiz_title,
    q.type::text as quiz_type,
    q.course_id,
    q.unit_id,
    case when q.unit_id is not null then 'unit' else 'course' end as quiz_scope
  from quizzes q
),
-- membresias activas del aprendiz
memberships as (
  select lm.local_id
  from local_memberships lm
  where lm.user_id = auth.uid()
    and lm.status = 'active'
    and lm.role = 'aprendiz'
),
-- assigned courses for local (active)
assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  join memberships m on m.local_id = lc.local_id
  where lc.status = 'active'
),
-- quiz + assignment filter
quiz_assigned as (
  select a.local_id, qb.*
  from assigned a
  join quiz_base qb on qb.course_id = a.course_id
),
-- user attempt (latest in_progress or latest submitted)
attempt_pick as (
  select *
  from (
    select
      qa.local_id,
      qa.quiz_id,
      qa.id as attempt_id,
      qa.user_id,
      qa.attempt_no,
      qa.score,
      qa.passed,
      qa.submitted_at,
      qa.created_at,
      row_number() over (
        partition by qa.local_id, qa.quiz_id
        order by (qa.submitted_at is null) desc, qa.created_at desc, qa.attempt_no desc
      ) as rn
    from quiz_attempts qa
    where qa.user_id = auth.uid()
  ) ranked
  where ranked.rn = 1
),
-- questions base
questions_base as (
  select qq.id as question_id,
         qq.quiz_id,
         qq.position,
         qq.prompt
  from quiz_questions qq
),
-- options base (no is_correct exposure)
options_base as (
  select qo.id as option_id,
         qo.question_id,
         qo.position,
         qo.option_text
  from quiz_options qo
),
-- user answers for current attempt
answers_base as (
  select
    qa.question_id,
    qa.option_id,
    qa.answer_text
  from quiz_answers qa
  join attempt_pick ap on ap.attempt_id = qa.attempt_id
  where qa.user_id = auth.uid()
),
-- question ordering with answered flag
question_order as (
  select
    qa.local_id,
    qa.quiz_id,
    qb.question_id,
    qb.position,
    row_number() over (
      partition by qa.local_id, qa.quiz_id
      order by qb.position
    ) as idx,
    case when ab.question_id is null then 1 else 0 end as is_pending
  from quiz_assigned qa
  join questions_base qb on qb.quiz_id = qa.quiz_id
  left join answers_base ab on ab.question_id = qb.question_id
),
-- first pending question
first_pending as (
  select ranked.local_id, ranked.quiz_id, ranked.question_id, ranked.idx as current_question_index
  from (
    select
      qo.local_id,
      qo.quiz_id,
      qo.question_id,
      qo.idx,
      row_number() over (
        partition by qo.local_id, qo.quiz_id
        order by qo.idx
      ) as pending_rn
    from question_order qo
    where qo.is_pending = 1
  ) ranked
  where ranked.pending_rn = 1
),
-- last question (stable fallback if all answered)
last_question as (
  select ranked.local_id, ranked.quiz_id, ranked.question_id, ranked.idx as last_question_index
  from (
    select
      qo.local_id,
      qo.quiz_id,
      qo.question_id,
      qo.idx,
      row_number() over (
        partition by qo.local_id, qo.quiz_id
        order by qo.idx desc
      ) as last_rn
    from question_order qo
  ) ranked
  where ranked.last_rn = 1
),
-- questions json with options and selected answer
questions_json as (
  select
    qa.local_id,
    qa.quiz_id,
    jsonb_agg(
      jsonb_build_object(
        'question_id', qb.question_id,
        'position', qb.position,
        'prompt', qb.prompt,
        'options', (
          select jsonb_agg(
            jsonb_build_object(
              'option_id', ob.option_id,
              'position', ob.position,
              'option_text', ob.option_text
            )
            order by ob.position
          )
          from options_base ob
          where ob.question_id = qb.question_id
        ),
        'selected_option_id', ab.option_id,
        'answer_text', ab.answer_text
      )
      order by qb.position
    ) as questions
  from quiz_assigned qa
  left join questions_base qb on qb.quiz_id = qa.quiz_id
  left join answers_base ab on ab.question_id = qb.question_id
  group by qa.local_id, qa.quiz_id
),
-- counts per quiz
counts as (
  select
    qa.local_id,
    qa.quiz_id,
    count(qb.question_id) as total_questions,
    count(ab.question_id) as answered_count
  from quiz_assigned qa
  left join questions_base qb on qb.quiz_id = qa.quiz_id
  left join answers_base ab on ab.question_id = qb.question_id
  group by qa.local_id, qa.quiz_id
)
select
  qa.local_id,
  qa.quiz_id,
  qa.quiz_title,
  qa.quiz_type,
  qa.course_id,
  qa.unit_id,
  qa.quiz_scope,
  coalesce(cnt.total_questions, 0) as total_questions,
  null::int as time_limit_minutes,
  null::int as pass_percent,
  ap.attempt_id,
  ap.attempt_no,
  case
    when ap.attempt_id is null then 'not_started'
    when ap.submitted_at is null then 'in_progress'
    else 'submitted'
  end as attempt_status,
  ap.created_at as started_at,
  ap.submitted_at,
  coalesce(cnt.answered_count, 0) as answered_count,
  coalesce(fp.current_question_index, lq.last_question_index) as current_question_index,
  coalesce(fp.question_id, lq.question_id) as current_question_id,
  qj.questions,
  ap.score,
  ap.passed
from quiz_assigned qa
left join attempt_pick ap
  on ap.local_id = qa.local_id
 and ap.quiz_id = qa.quiz_id
left join counts cnt
  on cnt.local_id = qa.local_id
 and cnt.quiz_id = qa.quiz_id
left join first_pending fp
  on fp.local_id = qa.local_id
 and fp.quiz_id = qa.quiz_id
left join last_question lq
  on lq.local_id = qa.local_id
 and lq.quiz_id = qa.quiz_id
left join questions_json qj
  on qj.local_id = qa.local_id
 and qj.quiz_id = qa.quiz_id;

-- Sanity queries (dev):
-- 1) curso NO asignado no aparece en dashboard del aprendiz
-- select * from v_learner_dashboard_courses where local_id = '<LOCAL>' and course_id = '<COURSE>';
-- 2) outline solo con asignaciones activas
-- select * from v_course_outline where local_id = '<LOCAL>' and course_id = '<COURSE>';
-- 3) lesson player solo con asignaciones activas
-- select * from v_lesson_player where local_id = '<LOCAL>' and lesson_id = '<LESSON>';
-- 4) quiz state solo con asignaciones activas
-- select * from v_quiz_state where local_id = '<LOCAL>' and quiz_id = '<QUIZ>';

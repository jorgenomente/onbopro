drop view if exists v_quiz_state;

create or replace view v_quiz_state as
-- quiz base with scope and course
with quiz_base as (
  select
    q.id as quiz_id,
    q.title as quiz_title,
    q.type::text as quiz_type,
    q.course_id,
    q.unit_id,
    q.time_limit_min,
    q.pass_score_pct,
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
  qa.time_limit_min,
  qa.pass_score_pct,
  qa.time_limit_min as time_limit_minutes,
  qa.pass_score_pct as pass_percent,
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

-- TODO(2026-02-01): remove legacy aliases time_limit_minutes/pass_percent after UI migration.

create or replace view v_quiz_state as
-- quiz base with scope and course
with quiz_base as (
  select
    q.id as quiz_id,
    q.title as quiz_title,
    q.course_id,
    q.unit_id,
    case when q.unit_id is not null then 'unit' else 'course' end as quiz_scope
  from quizzes q
),
-- assigned courses for local (active)
assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  where lc.status = 'active'
),
-- quiz + assignment filter
quiz_assigned as (
  select a.local_id, qb.*
  from assigned a
  join quiz_base qb on qb.course_id = a.course_id
),
-- questions base
questions_base as (
  select qq.id as question_id,
         qq.quiz_id,
         qq.position,
         qq.prompt
  from quiz_questions qq
),
-- options base
options_base as (
  select qo.id as option_id,
         qo.question_id,
         qo.position,
         qo.option_text
  from quiz_options qo
),
-- user attempt (latest in_progress or latest submitted)
user_attempt as (
  select *
  from (
    select
      qa.local_id,
      qa.quiz_id,
      qa.id as attempt_id,
      qa.user_id,
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
-- user answers for current attempt
user_answers as (
  select
    ta.local_id,
    ta.quiz_id,
    qa.attempt_id,
    qa.question_id,
    qa.option_id,
    qa.created_at
  from quiz_answers qa
  join quiz_attempts ta on ta.id = qa.attempt_id
  join user_attempt ua on ua.attempt_id = qa.attempt_id
  where qa.user_id = auth.uid()
),
-- question order with answered flag
question_order as (
  select
    qa.local_id,
    qa.quiz_id,
    qb.question_id,
    qb.position,
    row_number() over (
      partition by qa.local_id, qa.quiz_id
      order by qb.position
    ) as rn,
    case when ua.question_id is null then 1 else 0 end as is_pending
  from quiz_assigned qa
  join questions_base qb on qb.quiz_id = qa.quiz_id
  left join user_answers ua
    on ua.local_id = qa.local_id
   and ua.quiz_id = qa.quiz_id
   and ua.question_id = qb.question_id
),
-- first pending question for current index
first_pending as (
  select ranked.local_id, ranked.quiz_id, ranked.question_id, ranked.rn as current_question_index
  from (
    select
      qo.local_id,
      qo.quiz_id,
      qo.question_id,
      qo.rn,
      row_number() over (
        partition by qo.local_id, qo.quiz_id
        order by qo.rn
      ) as pending_rn
    from question_order qo
    where qo.is_pending = 1
  ) ranked
  where ranked.pending_rn = 1
),
-- questions json with options and selected option
questions_json as (
  select
    qa.local_id,
    qa.quiz_id,
    jsonb_agg(
      jsonb_build_object(
        'question_id', qb.question_id,
        'position', qb.position,
        'prompt', qb.prompt,
        'type', null,
        'options', (
          select jsonb_agg(
            jsonb_build_object(
              'option_id', ob.option_id,
              'position', ob.position,
              'text', ob.option_text
            )
            order by ob.position
          )
          from options_base ob
          where ob.question_id = qb.question_id
        ),
        'selected_option_id', ua.option_id
      )
      order by qb.position
    ) as questions
  from quiz_assigned qa
  left join questions_base qb on qb.quiz_id = qa.quiz_id
  left join user_answers ua
    on ua.local_id = qa.local_id
   and ua.quiz_id = qa.quiz_id
   and ua.question_id = qb.question_id
  group by qa.local_id, qa.quiz_id
),
-- counts per quiz
counts as (
  select
    qa.local_id,
    qa.quiz_id,
    count(qb.question_id) as total_questions,
    count(ua.question_id) as answered_count
  from quiz_assigned qa
  left join questions_base qb on qb.quiz_id = qa.quiz_id
  left join user_answers ua
    on ua.local_id = qa.local_id
   and ua.quiz_id = qa.quiz_id
   and ua.question_id = qb.question_id
  group by qa.local_id, qa.quiz_id
)
select
  qa.local_id,
  qa.quiz_id,
  qa.quiz_title,
  qa.quiz_scope,
  qa.course_id,
  qa.unit_id,
  coalesce(cnt.total_questions, 0) as total_questions,
  null::int as time_limit_minutes,
  null::int as pass_percent,
  ua.attempt_id,
  case
    when ua.attempt_id is null then 'not_started'
    when ua.submitted_at is null then 'in_progress'
    else 'submitted'
  end as attempt_status,
  ua.created_at as started_at,
  ua.submitted_at,
  coalesce(cnt.answered_count, 0) as answered_count,
  fp.current_question_index,
  fp.question_id as current_question_id,
  qj.questions,
  ua.score as score_percent,
  ua.passed
from quiz_assigned qa
left join user_attempt ua
  on ua.local_id = qa.local_id
 and ua.quiz_id = qa.quiz_id
left join counts cnt
  on cnt.local_id = qa.local_id
 and cnt.quiz_id = qa.quiz_id
left join first_pending fp
  on fp.local_id = qa.local_id
 and fp.quiz_id = qa.quiz_id
left join questions_json qj
  on qj.local_id = qa.local_id
 and qj.quiz_id = qa.quiz_id;

create or replace function is_local_course_active(
  p_local_id uuid,
  p_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from local_courses lc
    where lc.local_id = p_local_id
      and lc.course_id = p_course_id
      and lc.status = 'active'::local_course_status
  );
$$;

create or replace function can_insert_lesson_completion(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from local_memberships lm
    join course_units cu on cu.course_id is not null
    join lessons l on l.unit_id = cu.id
    where lm.user_id = auth.uid()
      and lm.role = 'aprendiz'
      and lm.status = 'active'
      and l.id = p_lesson_id
      and is_local_course_active(lm.local_id, cu.course_id)
  );
$$;

create or replace function can_insert_quiz_attempt(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from local_memberships lm
    join quizzes q on q.id = p_quiz_id
    where lm.user_id = auth.uid()
      and lm.role = 'aprendiz'
      and lm.status = 'active'
      and is_local_course_active(lm.local_id, q.course_id)
  );
$$;

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
    join local_courses lc on lc.local_id = lm.local_id
    join quizzes q on q.course_id = lc.course_id
    where lm.user_id = auth.uid()
      and lm.role = 'aprendiz'
      and lm.status = 'active'
      and lc.status = 'active'
      and q.id = p_quiz_id
  );
$$;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quiz_attempts'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.quiz_attempts', pol.policyname);
  end loop;
end;
$$;

create policy quiz_attempts_insert_own_aprendiz_only
  on quiz_attempts
  for insert
  with check (
    user_id = auth.uid()
    and can_insert_quiz_attempt(quiz_id)
  );

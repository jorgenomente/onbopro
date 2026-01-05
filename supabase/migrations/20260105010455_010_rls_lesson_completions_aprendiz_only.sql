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
    join local_courses lc on lc.local_id = lm.local_id
    join course_units cu on cu.course_id = lc.course_id
    join lessons l on l.unit_id = cu.id
    where lm.user_id = auth.uid()
      and lm.role = 'aprendiz'
      and lm.status = 'active'
      and lc.status = 'active'
      and l.id = p_lesson_id
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
      and tablename = 'lesson_completions'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.lesson_completions', pol.policyname);
  end loop;
end;
$$;

create policy lesson_completions_insert_own_aprendiz_only
  on lesson_completions
  for insert
  with check (
    user_id = auth.uid()
    and can_insert_lesson_completion(lesson_id)
  );

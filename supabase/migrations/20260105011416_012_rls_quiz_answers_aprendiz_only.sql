create or replace function can_insert_quiz_answer(
  p_user_id uuid,
  p_attempt_id uuid,
  p_question_id uuid,
  p_option_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id = auth.uid()
    and exists (
      select 1
      from quiz_attempts qa
      join quiz_questions qq on qq.quiz_id = qa.quiz_id
      left join quiz_options qo on qo.id = p_option_id
      where qa.id = p_attempt_id
        and qa.user_id = auth.uid()
        and qq.id = p_question_id
        and (p_option_id is null or qo.question_id = qq.id)
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
      and tablename = 'quiz_answers'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.quiz_answers', pol.policyname);
  end loop;
end;
$$;

create policy quiz_answers_insert_aprendiz_only
  on quiz_answers
  for insert
  with check (
    can_insert_quiz_answer(user_id, attempt_id, question_id, option_id)
  );

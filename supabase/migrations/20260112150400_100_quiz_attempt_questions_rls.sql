alter table public.quiz_attempt_questions enable row level security;

create or replace function public.can_insert_quiz_attempt_question(
  p_attempt_id uuid,
  p_question_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_attempts qa
    join public.quiz_questions qq on qq.id = p_question_id
    where qa.id = p_attempt_id
      and qa.user_id = auth.uid()
      and qq.quiz_id = qa.quiz_id
      and qq.archived_at is null
  );
$$;

create policy "quiz_attempt_questions: select scoped"
  on public.quiz_attempt_questions
  for select
  using (
    public.rls_is_superadmin()
    or exists (
      select 1
      from public.quiz_attempts qa
      where qa.id = quiz_attempt_questions.attempt_id
        and public.rls_is_org_admin(qa.org_id)
    )
    or exists (
      select 1
      from public.quiz_attempts qa
      where qa.id = quiz_attempt_questions.attempt_id
        and public.rls_is_local_referente(qa.local_id)
    )
    or exists (
      select 1
      from public.quiz_attempts qa
      where qa.id = quiz_attempt_questions.attempt_id
        and qa.user_id = auth.uid()
    )
  );

create policy "quiz_attempt_questions: insert own"
  on public.quiz_attempt_questions
  for insert
  with check (
    public.can_insert_quiz_attempt_question(attempt_id, question_id)
  );

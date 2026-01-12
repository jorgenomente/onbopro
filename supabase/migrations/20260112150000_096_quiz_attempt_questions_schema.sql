alter table public.quizzes
  add column if not exists num_questions int;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quizzes_num_questions_chk'
  ) then
    alter table public.quizzes
      add constraint quizzes_num_questions_chk
      check (num_questions is null or num_questions >= 1);
  end if;
end $$;

create table if not exists public.quiz_attempt_questions (
  attempt_id uuid not null references public.quiz_attempts(id) on delete restrict,
  question_id uuid not null references public.quiz_questions(id) on delete restrict,
  position int not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  unique (attempt_id, position)
);

create index if not exists quiz_attempt_questions_attempt_id_idx
  on public.quiz_attempt_questions(attempt_id);

create index if not exists quiz_attempt_questions_question_id_idx
  on public.quiz_attempt_questions(question_id);

create or replace function public.rls_enforce_quiz_attempt_question_integrity()
returns trigger
language plpgsql
as $$
declare
  v_attempt_quiz_id uuid;
  v_question_quiz_id uuid;
  v_archived_at timestamptz;
begin
  select qa.quiz_id into v_attempt_quiz_id
  from public.quiz_attempts qa
  where qa.id = new.attempt_id;

  if v_attempt_quiz_id is null then
    raise exception 'quiz_attempt_questions.attempt_id is invalid';
  end if;

  select qq.quiz_id, qq.archived_at
    into v_question_quiz_id, v_archived_at
  from public.quiz_questions qq
  where qq.id = new.question_id;

  if v_question_quiz_id is null then
    raise exception 'quiz_attempt_questions.question_id is invalid';
  end if;

  if v_archived_at is not null then
    raise exception 'quiz_attempt_questions.question is archived';
  end if;

  if v_question_quiz_id <> v_attempt_quiz_id then
    raise exception 'quiz_attempt_questions.question_id must belong to attempt quiz';
  end if;

  return new;
end;
$$;

create trigger trg_quiz_attempt_questions_integrity
before insert or update on public.quiz_attempt_questions
for each row
execute function public.rls_enforce_quiz_attempt_question_integrity();

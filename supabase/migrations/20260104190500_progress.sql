create table lesson_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  local_id uuid not null references locals(id),
  course_id uuid not null references courses(id),
  unit_id uuid not null references course_units(id),
  lesson_id uuid not null references lessons(id),
  user_id uuid not null references auth.users(id),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index lesson_completions_user_id_idx on lesson_completions(user_id);
create index lesson_completions_local_id_idx on lesson_completions(local_id);
create index lesson_completions_course_id_idx on lesson_completions(course_id);
create index lesson_completions_user_lesson_idx on lesson_completions(user_id, lesson_id);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  local_id uuid not null references locals(id),
  course_id uuid not null references courses(id),
  quiz_id uuid not null references quizzes(id),
  user_id uuid not null references auth.users(id),
  attempt_no integer not null,
  score integer,
  passed boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, quiz_id, attempt_no)
);

create index quiz_attempts_user_id_idx on quiz_attempts(user_id);
create index quiz_attempts_local_id_idx on quiz_attempts(local_id);
create index quiz_attempts_course_id_idx on quiz_attempts(course_id);
create index quiz_attempts_user_quiz_idx on quiz_attempts(user_id, quiz_id);

create table quiz_answers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  local_id uuid not null references locals(id),
  course_id uuid not null references courses(id),
  attempt_id uuid not null references quiz_attempts(id),
  question_id uuid not null references quiz_questions(id),
  user_id uuid not null references auth.users(id),
  option_id uuid references quiz_options(id),
  answer_text text,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index quiz_answers_attempt_id_idx on quiz_answers(attempt_id);
create index quiz_answers_user_id_idx on quiz_answers(user_id);
create index quiz_answers_local_id_idx on quiz_answers(local_id);
create index quiz_answers_course_id_idx on quiz_answers(course_id);

create or replace function rls_enforce_lesson_completion_integrity()
returns trigger
language plpgsql
as $$
declare
  local_org_id uuid;
  course_org_id uuid;
  unit_course_id uuid;
  lesson_unit_id uuid;
begin
  select l.org_id into local_org_id
  from locals l
  where l.id = new.local_id;

  if local_org_id is null then
    raise exception 'lesson_completions.local_id is invalid';
  end if;

  select c.org_id into course_org_id
  from courses c
  where c.id = new.course_id;

  if course_org_id is null then
    raise exception 'lesson_completions.course_id is invalid';
  end if;

  select u.course_id into unit_course_id
  from course_units u
  where u.id = new.unit_id;

  if unit_course_id is null then
    raise exception 'lesson_completions.unit_id is invalid';
  end if;

  select l.unit_id into lesson_unit_id
  from lessons l
  where l.id = new.lesson_id;

  if lesson_unit_id is null then
    raise exception 'lesson_completions.lesson_id is invalid';
  end if;

  if lesson_unit_id <> new.unit_id then
    raise exception 'lesson_completions.lesson_id must belong to unit_id';
  end if;

  if unit_course_id <> new.course_id then
    raise exception 'lesson_completions.unit_id must belong to course_id';
  end if;

  if new.org_id <> local_org_id or new.org_id <> course_org_id then
    raise exception 'lesson_completions.org_id must match locals.org_id and courses.org_id';
  end if;

  return new;
end;
$$;

create trigger trg_lesson_completions_integrity
before insert or update on lesson_completions
for each row
execute function rls_enforce_lesson_completion_integrity();

create or replace function rls_enforce_quiz_attempt_integrity()
returns trigger
language plpgsql
as $$
declare
  local_org_id uuid;
  course_org_id uuid;
  quiz_course_id uuid;
begin
  select l.org_id into local_org_id
  from locals l
  where l.id = new.local_id;

  if local_org_id is null then
    raise exception 'quiz_attempts.local_id is invalid';
  end if;

  select c.org_id into course_org_id
  from courses c
  where c.id = new.course_id;

  if course_org_id is null then
    raise exception 'quiz_attempts.course_id is invalid';
  end if;

  select q.course_id into quiz_course_id
  from quizzes q
  where q.id = new.quiz_id;

  if quiz_course_id is null then
    raise exception 'quiz_attempts.quiz_id is invalid';
  end if;

  if quiz_course_id <> new.course_id then
    raise exception 'quiz_attempts.quiz_id must belong to course_id';
  end if;

  if new.org_id <> local_org_id or new.org_id <> course_org_id then
    raise exception 'quiz_attempts.org_id must match locals.org_id and courses.org_id';
  end if;

  return new;
end;
$$;

create trigger trg_quiz_attempts_integrity
before insert or update on quiz_attempts
for each row
execute function rls_enforce_quiz_attempt_integrity();

create or replace function rls_enforce_quiz_answer_integrity()
returns trigger
language plpgsql
as $$
declare
  attempt_org_id uuid;
  attempt_local_id uuid;
  attempt_course_id uuid;
  attempt_user_id uuid;
  attempt_quiz_id uuid;
  question_quiz_id uuid;
begin
  select a.org_id, a.local_id, a.course_id, a.user_id, a.quiz_id
    into attempt_org_id, attempt_local_id, attempt_course_id, attempt_user_id, attempt_quiz_id
  from quiz_attempts a
  where a.id = new.attempt_id;

  if attempt_org_id is null then
    raise exception 'quiz_answers.attempt_id is invalid';
  end if;

  select qq.quiz_id into question_quiz_id
  from quiz_questions qq
  where qq.id = new.question_id;

  if question_quiz_id is null then
    raise exception 'quiz_answers.question_id is invalid';
  end if;

  if question_quiz_id <> attempt_quiz_id then
    raise exception 'quiz_answers.question_id must belong to attempt quiz';
  end if;

  if new.org_id <> attempt_org_id
     or new.local_id <> attempt_local_id
     or new.course_id <> attempt_course_id
     or new.user_id <> attempt_user_id then
    raise exception 'quiz_answers org/local/course/user must match attempt';
  end if;

  return new;
end;
$$;

create trigger trg_quiz_answers_integrity
before insert or update on quiz_answers
for each row
execute function rls_enforce_quiz_answer_integrity();

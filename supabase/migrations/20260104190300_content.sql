create table courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  title text not null,
  status course_status not null default 'draft',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index courses_org_id_idx on courses(org_id);
create index courses_status_idx on courses(status);

create table course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  title text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create index course_units_course_id_idx on course_units(course_id);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references course_units(id),
  title text not null,
  position integer not null,
  content_type text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (unit_id, position)
);

create index lessons_unit_id_idx on lessons(unit_id);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  unit_id uuid references course_units(id),
  type quiz_type not null,
  title text not null,
  created_at timestamptz not null default now(),
  check ((type = 'unit' and unit_id is not null) or (type = 'final' and unit_id is null))
);

create unique index quizzes_unit_unique_idx on quizzes(unit_id) where type = 'unit';
create unique index quizzes_final_unique_idx on quizzes(course_id) where type = 'final';
create index quizzes_course_id_idx on quizzes(course_id);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id),
  position integer not null,
  prompt text not null,
  created_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create index quiz_questions_quiz_id_idx on quiz_questions(quiz_id);

create table quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references quiz_questions(id),
  position integer not null,
  option_text text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, position)
);

create index quiz_options_question_id_idx on quiz_options(question_id);

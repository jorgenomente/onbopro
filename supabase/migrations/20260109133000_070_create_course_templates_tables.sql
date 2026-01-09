create table if not exists public.course_templates (
  template_id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status course_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_templates_status_idx
  on public.course_templates(status);

create table if not exists public.course_template_units (
  unit_id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.course_templates(template_id)
    on delete cascade,
  title text not null,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, position)
);

create index if not exists course_template_units_template_id_idx
  on public.course_template_units(template_id);

create table if not exists public.course_template_lessons (
  lesson_id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.course_template_units(unit_id)
    on delete cascade,
  title text not null,
  position int not null,
  content_type text not null,
  content jsonb not null default '{}'::jsonb,
  estimated_minutes int,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, position)
);

create index if not exists course_template_lessons_unit_id_idx
  on public.course_template_lessons(unit_id);

create table if not exists public.course_template_quizzes (
  quiz_id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.course_templates(template_id)
    on delete cascade,
  unit_id uuid references public.course_template_units(unit_id)
    on delete cascade,
  type quiz_type not null,
  title text not null,
  description text,
  time_limit_min int,
  pass_score_pct numeric not null default 80,
  shuffle_questions boolean not null default false,
  show_correct_answers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'unit' and unit_id is not null)
    or (type = 'final' and unit_id is null)
  )
);

create unique index if not exists course_template_quizzes_unit_unique_idx
  on public.course_template_quizzes(unit_id)
  where type = 'unit';

create unique index if not exists course_template_quizzes_final_unique_idx
  on public.course_template_quizzes(template_id)
  where type = 'final';

create index if not exists course_template_quizzes_template_id_idx
  on public.course_template_quizzes(template_id);

create table if not exists public.course_template_quiz_questions (
  question_id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.course_template_quizzes(quiz_id)
    on delete cascade,
  position int not null,
  prompt text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create index if not exists course_template_quiz_questions_quiz_id_idx
  on public.course_template_quiz_questions(quiz_id);

create table if not exists public.course_template_quiz_choices (
  choice_id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.course_template_quiz_questions(question_id)
    on delete cascade,
  position int not null,
  option_text text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, position)
);

create index if not exists course_template_quiz_choices_question_id_idx
  on public.course_template_quiz_choices(question_id);

drop trigger if exists trg_course_templates_updated_at on public.course_templates;
create trigger trg_course_templates_updated_at
before update on public.course_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_course_template_units_updated_at on public.course_template_units;
create trigger trg_course_template_units_updated_at
before update on public.course_template_units
for each row execute function public.set_updated_at();

drop trigger if exists trg_course_template_lessons_updated_at on public.course_template_lessons;
create trigger trg_course_template_lessons_updated_at
before update on public.course_template_lessons
for each row execute function public.set_updated_at();

drop trigger if exists trg_course_template_quizzes_updated_at on public.course_template_quizzes;
create trigger trg_course_template_quizzes_updated_at
before update on public.course_template_quizzes
for each row execute function public.set_updated_at();

drop trigger if exists trg_course_template_quiz_questions_updated_at
  on public.course_template_quiz_questions;
create trigger trg_course_template_quiz_questions_updated_at
before update on public.course_template_quiz_questions
for each row execute function public.set_updated_at();

drop trigger if exists trg_course_template_quiz_choices_updated_at
  on public.course_template_quiz_choices;
create trigger trg_course_template_quiz_choices_updated_at
before update on public.course_template_quiz_choices
for each row execute function public.set_updated_at();

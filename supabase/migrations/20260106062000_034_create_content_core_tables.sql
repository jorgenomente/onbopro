do $outer$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pronamespace = 'public'::regnamespace
  ) then
    execute $fn$
      create function public.set_updated_at()
      returns trigger
      language plpgsql
      as $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$;
    $fn$;
  end if;
end $outer$;

alter table courses
  add column if not exists description text,
  add column if not exists cover_image_url text,
  add column if not exists category text,
  add column if not exists level text,
  add column if not exists estimated_duration_minutes int,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);

update courses
set published_at = coalesce(published_at, created_at)
where status = 'published'
  and published_at is null;

update courses
set archived_at = coalesce(archived_at, created_at)
where status = 'archived'
  and archived_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_published_at_chk'
  ) then
    alter table courses
      add constraint courses_published_at_chk
      check (status <> 'published' or published_at is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_archived_at_chk'
  ) then
    alter table courses
      add constraint courses_archived_at_chk
      check (status <> 'archived' or archived_at is not null);
  end if;
end $$;

create index if not exists courses_org_updated_at_idx
  on courses(org_id, updated_at desc);

alter table course_units
  add column if not exists updated_at timestamptz not null default now();

alter table lessons
  add column if not exists estimated_minutes int,
  add column if not exists is_required boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table quizzes
  add column if not exists description text,
  add column if not exists time_limit_min int,
  add column if not exists pass_score_pct numeric not null default 80,
  add column if not exists shuffle_questions boolean not null default false,
  add column if not exists show_correct_answers boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quizzes_pass_score_pct_chk'
  ) then
    alter table quizzes
      add constraint quizzes_pass_score_pct_chk
      check (pass_score_pct >= 0 and pass_score_pct <= 100);
  end if;
end $$;

alter table quiz_questions
  add column if not exists updated_at timestamptz not null default now();

alter table quiz_options
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_courses_updated_at on courses;
create trigger trg_courses_updated_at
before update on courses
for each row
execute function public.set_updated_at();

drop trigger if exists trg_course_units_updated_at on course_units;
create trigger trg_course_units_updated_at
before update on course_units
for each row
execute function public.set_updated_at();

drop trigger if exists trg_lessons_updated_at on lessons;
create trigger trg_lessons_updated_at
before update on lessons
for each row
execute function public.set_updated_at();

drop trigger if exists trg_quizzes_updated_at on quizzes;
create trigger trg_quizzes_updated_at
before update on quizzes
for each row
execute function public.set_updated_at();

drop trigger if exists trg_quiz_questions_updated_at on quiz_questions;
create trigger trg_quiz_questions_updated_at
before update on quiz_questions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_quiz_options_updated_at on quiz_options;
create trigger trg_quiz_options_updated_at
before update on quiz_options
for each row
execute function public.set_updated_at();

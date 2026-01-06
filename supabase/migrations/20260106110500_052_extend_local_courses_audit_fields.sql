alter table local_courses
  add column if not exists assigned_by uuid,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

drop trigger if exists trg_local_courses_updated_at on local_courses;
create trigger trg_local_courses_updated_at
before update on local_courses
for each row
execute function public.set_updated_at();

-- Sanity checks (manual)
-- select * from local_courses limit 5;
-- update local_courses set status = status where local_id = '<local_id>' and course_id = '<course_id>';

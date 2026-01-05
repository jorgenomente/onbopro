create table local_courses (
  org_id uuid not null references organizations(id),
  local_id uuid not null references locals(id),
  course_id uuid not null references courses(id),
  status local_course_status not null default 'active',
  assigned_at timestamptz not null default now(),
  primary key (local_id, course_id)
);

create index local_courses_org_id_idx on local_courses(org_id);
create index local_courses_local_status_idx on local_courses(local_id, status);
create index local_courses_course_id_idx on local_courses(course_id);

create or replace function rls_enforce_local_courses_org()
returns trigger
language plpgsql
as $$
declare
  local_org_id uuid;
  course_org_id uuid;
begin
  select l.org_id into local_org_id
  from locals l
  where l.id = new.local_id;

  if local_org_id is null then
    raise exception 'local_courses.local_id is invalid';
  end if;

  select c.org_id into course_org_id
  from courses c
  where c.id = new.course_id;

  if course_org_id is null then
    raise exception 'local_courses.course_id is invalid';
  end if;

  if new.org_id <> local_org_id or new.org_id <> course_org_id then
    raise exception 'local_courses.org_id must match locals.org_id and courses.org_id';
  end if;

  return new;
end;
$$;

create trigger trg_local_courses_org
before insert or update on local_courses
for each row
execute function rls_enforce_local_courses_org();

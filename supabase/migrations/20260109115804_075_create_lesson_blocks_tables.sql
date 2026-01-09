create table if not exists public.lesson_blocks (
  block_id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_type text not null,
  data jsonb not null default '{}'::jsonb,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists lesson_blocks_org_id_idx
  on public.lesson_blocks(org_id);

create index if not exists lesson_blocks_lesson_id_idx
  on public.lesson_blocks(lesson_id);

create index if not exists lesson_blocks_lesson_active_idx
  on public.lesson_blocks(lesson_id, archived_at);

create unique index if not exists lesson_blocks_lesson_position_active_idx
  on public.lesson_blocks(lesson_id, position)
  where archived_at is null;

create or replace function public.rls_enforce_lesson_blocks_org()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
begin
  select c.org_id
    into v_org_id
  from public.lessons l
  join public.course_units cu on cu.id = l.unit_id
  join public.courses c on c.id = cu.course_id
  where l.id = new.lesson_id;

  if v_org_id is null then
    raise exception 'lesson_blocks.lesson_id is invalid';
  end if;

  new.org_id = v_org_id;
  return new;
end;
$$;

drop trigger if exists trg_lesson_blocks_org on public.lesson_blocks;
create trigger trg_lesson_blocks_org
before insert or update on public.lesson_blocks
for each row
execute function public.rls_enforce_lesson_blocks_org();

drop trigger if exists trg_lesson_blocks_updated_at on public.lesson_blocks;
create trigger trg_lesson_blocks_updated_at
before update on public.lesson_blocks
for each row
execute function public.set_updated_at();

create table if not exists public.course_template_lesson_blocks (
  block_id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_template_lessons(lesson_id)
    on delete cascade,
  block_type text not null,
  data jsonb not null default '{}'::jsonb,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists course_template_lesson_blocks_lesson_id_idx
  on public.course_template_lesson_blocks(lesson_id);

create index if not exists course_template_lesson_blocks_lesson_active_idx
  on public.course_template_lesson_blocks(lesson_id, archived_at);

create unique index if not exists course_template_lesson_blocks_position_active_idx
  on public.course_template_lesson_blocks(lesson_id, position)
  where archived_at is null;

drop trigger if exists trg_course_template_lesson_blocks_updated_at
  on public.course_template_lesson_blocks;
create trigger trg_course_template_lesson_blocks_updated_at
before update on public.course_template_lesson_blocks
for each row
execute function public.set_updated_at();

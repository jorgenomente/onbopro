create or replace function public.rpc_reorder_course_units(
  p_course_id uuid,
  p_unit_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_units int;
  v_unique_units int;
  v_matching_units int;
  v_offset int;
  v_idx int;
  v_unit_id uuid;
begin
  if p_unit_ids is null or array_length(p_unit_ids, 1) is null then
    raise exception 'Unit list required' using errcode = '22023';
  end if;

  if not public.can_manage_course(p_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_total_units
  from public.course_units
  where course_id = p_course_id;

  select count(*) into v_unique_units
  from (
    select distinct unnest(p_unit_ids) as unit_id
  ) units;

  select count(*) into v_matching_units
  from public.course_units
  where course_id = p_course_id
    and id = any(p_unit_ids);

  if v_total_units <> array_length(p_unit_ids, 1) then
    raise exception 'Unit list must include all units' using errcode = '22023';
  end if;

  if v_unique_units <> array_length(p_unit_ids, 1) then
    raise exception 'Unit list contains duplicates' using errcode = '22023';
  end if;

  if v_matching_units <> v_total_units then
    raise exception 'Unit list contains invalid ids' using errcode = '22023';
  end if;

  select coalesce(max(abs(position)), 0) + 10000
    into v_offset
  from public.course_units
  where course_id = p_course_id;

  for v_idx in 1..array_length(p_unit_ids, 1) loop
    v_unit_id := p_unit_ids[v_idx];
    update public.course_units
    set position = -(v_offset + v_idx)
    where id = v_unit_id
      and course_id = p_course_id;
  end loop;

  for v_idx in 1..array_length(p_unit_ids, 1) loop
    v_unit_id := p_unit_ids[v_idx];
    update public.course_units
    set position = v_idx
    where id = v_unit_id
      and course_id = p_course_id;
  end loop;
end;
$$;

create or replace function public.rpc_reorder_unit_lessons(
  p_unit_id uuid,
  p_lesson_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_total_lessons int;
  v_unique_lessons int;
  v_matching_lessons int;
  v_offset int;
  v_idx int;
  v_lesson_id uuid;
begin
  select cu.course_id
    into v_course_id
  from public.course_units cu
  where cu.id = p_unit_id;

  if v_course_id is null then
    raise exception 'Unit not found' using errcode = 'P0002';
  end if;

  if p_lesson_ids is null or array_length(p_lesson_ids, 1) is null then
    raise exception 'Lesson list required' using errcode = '22023';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_total_lessons
  from public.lessons
  where unit_id = p_unit_id;

  select count(*) into v_unique_lessons
  from (
    select distinct unnest(p_lesson_ids) as lesson_id
  ) lessons;

  select count(*) into v_matching_lessons
  from public.lessons
  where unit_id = p_unit_id
    and id = any(p_lesson_ids);

  if v_total_lessons <> array_length(p_lesson_ids, 1) then
    raise exception 'Lesson list must include all lessons' using errcode = '22023';
  end if;

  if v_unique_lessons <> array_length(p_lesson_ids, 1) then
    raise exception 'Lesson list contains duplicates' using errcode = '22023';
  end if;

  if v_matching_lessons <> v_total_lessons then
    raise exception 'Lesson list contains invalid ids' using errcode = '22023';
  end if;

  select coalesce(max(abs(position)), 0) + 10000
    into v_offset
  from public.lessons
  where unit_id = p_unit_id;

  for v_idx in 1..array_length(p_lesson_ids, 1) loop
    v_lesson_id := p_lesson_ids[v_idx];
    update public.lessons
    set position = -(v_offset + v_idx)
    where id = v_lesson_id
      and unit_id = p_unit_id;
  end loop;

  for v_idx in 1..array_length(p_lesson_ids, 1) loop
    v_lesson_id := p_lesson_ids[v_idx];
    update public.lessons
    set position = v_idx
    where id = v_lesson_id
      and unit_id = p_unit_id;
  end loop;
end;
$$;

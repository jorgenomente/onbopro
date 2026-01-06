create or replace function public.can_manage_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.rls_is_superadmin()
    or exists (
      select 1
      from public.courses c
      where c.id = p_course_id
        and public.rls_is_org_admin(c.org_id)
    );
$$;

create or replace function public.rpc_create_course_unit(
  p_course_id uuid,
  p_title text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
  v_position int;
  v_course_org_id uuid;
begin
  select c.org_id
    into v_course_org_id
  from public.courses c
  where c.id = p_course_id;

  if v_course_org_id is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(p_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.course_units
  where course_id = p_course_id;

  insert into public.course_units (course_id, title, position)
  values (p_course_id, p_title, v_position)
  returning id into v_unit_id;

  return v_unit_id;
end;
$$;

grant execute on function public.rpc_create_course_unit(uuid, text) to authenticated;

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

  select count(distinct unnest(p_unit_ids)) into v_unique_units;

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

  with ordered as (
    select unnest(p_unit_ids) as unit_id, ordinality as position
    from unnest(p_unit_ids) with ordinality
  )
  update public.course_units cu
  set position = ordered.position
  from ordered
  where cu.id = ordered.unit_id
    and cu.course_id = p_course_id;
end;
$$;

grant execute on function public.rpc_reorder_course_units(uuid, uuid[]) to authenticated;

create or replace function public.rpc_create_unit_lesson(
  p_unit_id uuid,
  p_title text,
  p_lesson_type text,
  p_is_required boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_lesson_id uuid;
  v_position int;
begin
  select cu.course_id
    into v_course_id
  from public.course_units cu
  where cu.id = p_unit_id;

  if v_course_id is null then
    raise exception 'Unit not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_lesson_type not in ('text', 'video_url', 'file', 'link') then
    raise exception 'Invalid lesson_type' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.lessons
  where unit_id = p_unit_id;

  insert into public.lessons (
    unit_id,
    title,
    position,
    content_type,
    content,
    estimated_minutes,
    is_required
  ) values (
    p_unit_id,
    p_title,
    v_position,
    p_lesson_type,
    '{}'::jsonb,
    null,
    coalesce(p_is_required, true)
  )
  returning id into v_lesson_id;

  return v_lesson_id;
end;
$$;

grant execute on function public.rpc_create_unit_lesson(uuid, text, text, boolean) to authenticated;

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

  select count(distinct unnest(p_lesson_ids)) into v_unique_lessons;

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

  with ordered as (
    select unnest(p_lesson_ids) as lesson_id, ordinality as position
    from unnest(p_lesson_ids) with ordinality
  )
  update public.lessons l
  set position = ordered.position
  from ordered
  where l.id = ordered.lesson_id
    and l.unit_id = p_unit_id;
end;
$$;

grant execute on function public.rpc_reorder_unit_lessons(uuid, uuid[]) to authenticated;

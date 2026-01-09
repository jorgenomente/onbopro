create or replace function public.rpc_create_lesson_block(
  p_lesson_id uuid,
  p_block_type text,
  p_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_org_id uuid;
  v_block_id uuid;
  v_position int;
  v_block_type text;
  v_data jsonb;
begin
  select c.id, c.org_id
    into v_course_id, v_org_id
  from public.lessons l
  join public.course_units cu on cu.id = l.unit_id
  join public.courses c on c.id = cu.course_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_block_type := trim(coalesce(p_block_type, ''));
  if v_block_type = '' then
    raise exception 'block_type required' using errcode = '22023';
  end if;

  v_data := coalesce(p_data, '{}'::jsonb);

  select coalesce(max(position), 0) + 1
    into v_position
  from public.lesson_blocks
  where lesson_id = p_lesson_id
    and archived_at is null;

  insert into public.lesson_blocks (
    org_id,
    lesson_id,
    block_type,
    data,
    position
  ) values (
    v_org_id,
    p_lesson_id,
    v_block_type,
    v_data,
    v_position
  )
  returning block_id into v_block_id;

  return v_block_id;
end;
$$;

create or replace function public.rpc_update_lesson_block(
  p_block_id uuid,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_row_count int;
begin
  select c.id
    into v_course_id
  from public.lesson_blocks b
  join public.lessons l on l.id = b.lesson_id
  join public.course_units cu on cu.id = l.unit_id
  join public.courses c on c.id = cu.course_id
  where b.block_id = p_block_id;

  if v_course_id is null then
    raise exception 'Block not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.lesson_blocks
  set data = coalesce(p_data, data)
  where block_id = p_block_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Block not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_archive_lesson_block(
  p_block_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_row_count int;
begin
  select c.id
    into v_course_id
  from public.lesson_blocks b
  join public.lessons l on l.id = b.lesson_id
  join public.course_units cu on cu.id = l.unit_id
  join public.courses c on c.id = cu.course_id
  where b.block_id = p_block_id;

  if v_course_id is null then
    raise exception 'Block not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.lesson_blocks
  set archived_at = now()
  where block_id = p_block_id
    and archived_at is null;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Block not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_reorder_lesson_blocks(
  p_lesson_id uuid,
  p_block_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_total_blocks int;
  v_unique_blocks int;
  v_matching_blocks int;
begin
  select cu.course_id
    into v_course_id
  from public.lessons l
  join public.course_units cu on cu.id = l.unit_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;

  if p_block_ids is null or array_length(p_block_ids, 1) is null then
    raise exception 'Block list required' using errcode = '22023';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_total_blocks
  from public.lesson_blocks
  where lesson_id = p_lesson_id
    and archived_at is null;

  select count(distinct unnest(p_block_ids)) into v_unique_blocks;

  select count(*) into v_matching_blocks
  from public.lesson_blocks
  where lesson_id = p_lesson_id
    and archived_at is null
    and block_id = any(p_block_ids);

  if v_total_blocks <> array_length(p_block_ids, 1) then
    raise exception 'Block list must include all blocks' using errcode = '22023';
  end if;

  if v_unique_blocks <> array_length(p_block_ids, 1) then
    raise exception 'Block list has duplicates' using errcode = '22023';
  end if;

  if v_matching_blocks <> v_total_blocks then
    raise exception 'Block list has invalid ids' using errcode = '22023';
  end if;

  with ordered as (
    select unnest(p_block_ids) as block_id,
           generate_subscripts(p_block_ids, 1) as position
  )
  update public.lesson_blocks b
  set position = ordered.position
  from ordered
  where b.block_id = ordered.block_id
    and b.lesson_id = p_lesson_id
    and b.archived_at is null;
end;
$$;

create or replace function public.rpc_create_template_lesson_block(
  p_lesson_id uuid,
  p_block_type text,
  p_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block_id uuid;
  v_position int;
  v_block_type text;
  v_data jsonb;
  v_lesson_exists boolean;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select exists(
    select 1 from public.course_template_lessons l where l.lesson_id = p_lesson_id
  ) into v_lesson_exists;

  if not v_lesson_exists then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;

  v_block_type := trim(coalesce(p_block_type, ''));
  if v_block_type = '' then
    raise exception 'block_type required' using errcode = '22023';
  end if;

  v_data := coalesce(p_data, '{}'::jsonb);

  select coalesce(max(position), 0) + 1
    into v_position
  from public.course_template_lesson_blocks
  where lesson_id = p_lesson_id
    and archived_at is null;

  insert into public.course_template_lesson_blocks (
    lesson_id,
    block_type,
    data,
    position
  ) values (
    p_lesson_id,
    v_block_type,
    v_data,
    v_position
  )
  returning block_id into v_block_id;

  return v_block_id;
end;
$$;

create or replace function public.rpc_update_template_lesson_block(
  p_block_id uuid,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.course_template_lesson_blocks
  set data = coalesce(p_data, data)
  where block_id = p_block_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Block not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_archive_template_lesson_block(
  p_block_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.course_template_lesson_blocks
  set archived_at = now()
  where block_id = p_block_id
    and archived_at is null;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Block not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_reorder_template_lesson_blocks(
  p_lesson_id uuid,
  p_block_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_blocks int;
  v_unique_blocks int;
  v_matching_blocks int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_block_ids is null or array_length(p_block_ids, 1) is null then
    raise exception 'Block list required' using errcode = '22023';
  end if;

  select count(*) into v_total_blocks
  from public.course_template_lesson_blocks
  where lesson_id = p_lesson_id
    and archived_at is null;

  select count(distinct unnest(p_block_ids)) into v_unique_blocks;

  select count(*) into v_matching_blocks
  from public.course_template_lesson_blocks
  where lesson_id = p_lesson_id
    and archived_at is null
    and block_id = any(p_block_ids);

  if v_total_blocks <> array_length(p_block_ids, 1) then
    raise exception 'Block list must include all blocks' using errcode = '22023';
  end if;

  if v_unique_blocks <> array_length(p_block_ids, 1) then
    raise exception 'Block list has duplicates' using errcode = '22023';
  end if;

  if v_matching_blocks <> v_total_blocks then
    raise exception 'Block list has invalid ids' using errcode = '22023';
  end if;

  with ordered as (
    select unnest(p_block_ids) as block_id,
           generate_subscripts(p_block_ids, 1) as position
  )
  update public.course_template_lesson_blocks b
  set position = ordered.position
  from ordered
  where b.block_id = ordered.block_id
    and b.lesson_id = p_lesson_id
    and b.archived_at is null;
end;
$$;

grant execute on function public.rpc_create_lesson_block(uuid, text, jsonb) to authenticated;
grant execute on function public.rpc_update_lesson_block(uuid, jsonb) to authenticated;
grant execute on function public.rpc_archive_lesson_block(uuid) to authenticated;
grant execute on function public.rpc_reorder_lesson_blocks(uuid, uuid[]) to authenticated;
grant execute on function public.rpc_create_template_lesson_block(uuid, text, jsonb) to authenticated;
grant execute on function public.rpc_update_template_lesson_block(uuid, jsonb) to authenticated;
grant execute on function public.rpc_archive_template_lesson_block(uuid) to authenticated;
grant execute on function public.rpc_reorder_template_lesson_blocks(uuid, uuid[]) to authenticated;

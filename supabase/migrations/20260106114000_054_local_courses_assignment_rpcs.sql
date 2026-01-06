create or replace function public.rpc_set_local_courses(
  p_local_id uuid,
  p_course_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_desired_count int;
  v_valid_count int;
  v_user_id uuid;
begin
  select l.org_id
    into v_org_id
  from public.locals l
  where l.id = p_local_id;

  if v_org_id is null then
    raise exception 'Local not found' using errcode = 'P0002';
  end if;

  if not (public.rls_is_superadmin() or public.rls_is_org_admin(v_org_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_user_id := auth.uid();

  with desired as (
    select distinct unnest(coalesce(p_course_ids, array[]::uuid[])) as course_id
  )
  select count(*) into v_desired_count from desired;

  with desired as (
    select distinct unnest(coalesce(p_course_ids, array[]::uuid[])) as course_id
  )
  select count(*)
    into v_valid_count
  from public.courses c
  join desired d on d.course_id = c.id
  where c.org_id = v_org_id;

  if v_valid_count <> v_desired_count then
    raise exception 'Course list contains invalid ids' using errcode = '22023';
  end if;

  with desired as (
    select distinct unnest(coalesce(p_course_ids, array[]::uuid[])) as course_id
  )
  update public.local_courses lc
  set
    status = 'archived',
    archived_at = now(),
    archived_by = v_user_id,
    updated_by = v_user_id
  where lc.local_id = p_local_id
    and lc.status = 'active'
    and not exists (
      select 1
      from desired d
      where d.course_id = lc.course_id
    );

  with desired as (
    select distinct unnest(coalesce(p_course_ids, array[]::uuid[])) as course_id
  )
  update public.local_courses lc
  set
    status = 'active',
    assigned_at = coalesce(lc.assigned_at, now()),
    assigned_by = coalesce(lc.assigned_by, v_user_id),
    archived_at = null,
    archived_by = null,
    updated_by = v_user_id
  where lc.local_id = p_local_id
    and lc.course_id in (select course_id from desired)
    and lc.status <> 'active';

  with desired as (
    select distinct unnest(coalesce(p_course_ids, array[]::uuid[])) as course_id
  )
  insert into public.local_courses (
    org_id,
    local_id,
    course_id,
    status,
    assigned_at,
    assigned_by,
    created_by,
    updated_by
  )
  select
    v_org_id,
    p_local_id,
    d.course_id,
    'active',
    now(),
    v_user_id,
    v_user_id,
    v_user_id
  from desired d
  left join public.local_courses lc
    on lc.local_id = p_local_id
   and lc.course_id = d.course_id
  where lc.course_id is null;
end;
$$;

revoke all on function public.rpc_set_local_courses(uuid, uuid[]) from public;
grant execute on function public.rpc_set_local_courses(uuid, uuid[]) to authenticated;

-- Sanity checks (manual)
-- select * from public.local_courses where local_id = '<local_id>';
-- select * from public.v_org_local_courses where local_id = '<local_id>' order by is_assigned desc, title asc;
-- select status, count(*) from public.local_courses where local_id = '<local_id>' group by 1;

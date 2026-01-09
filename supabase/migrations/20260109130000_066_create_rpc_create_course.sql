create or replace function public.rpc_create_course(
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_count int;
  v_course_id uuid;
  v_title text;
  v_description text;
begin
  v_title := trim(coalesce(p_title, ''));
  v_description := nullif(trim(coalesce(p_description, '')), '');

  if v_title = '' then
    raise exception 'title required' using errcode = '22023';
  end if;

  select count(*)
    into v_count
  from public.org_memberships om
  where om.user_id = auth.uid()
    and om.role = 'org_admin'
    and om.status = 'active';

  if v_count = 0 then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_count > 1 then
    raise exception 'org_id required' using errcode = '22023';
  end if;

  select om.org_id
    into v_org_id
  from public.org_memberships om
  where om.user_id = auth.uid()
    and om.role = 'org_admin'
    and om.status = 'active'
  limit 1;

  if v_org_id is null then
    raise exception 'org_id not resolved' using errcode = '22023';
  end if;

  insert into public.courses (
    org_id,
    title,
    description,
    status,
    created_by,
    updated_by
  ) values (
    v_org_id,
    v_title,
    v_description,
    'draft',
    auth.uid(),
    auth.uid()
  )
  returning id into v_course_id;

  return v_course_id;
end;
$$;

revoke all on function public.rpc_create_course(text, text) from public;
grant execute on function public.rpc_create_course(text, text) to authenticated;

-- select public.rpc_create_course('Curso Demo', null);

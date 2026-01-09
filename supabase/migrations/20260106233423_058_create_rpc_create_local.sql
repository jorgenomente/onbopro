create or replace function public.rpc_create_local(
  p_org_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_name text;
  v_local_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_org_id is null then
    raise exception 'org_id required' using errcode = '22023';
  end if;

  select o.id
    into v_org_id
  from public.organizations o
  where o.id = p_org_id;

  if v_org_id is null then
    raise exception 'org not found' using errcode = '22023';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'name required' using errcode = '22023';
  end if;

  if length(v_name) > 120 then
    raise exception 'name too long' using errcode = '22023';
  end if;

  insert into public.locals (org_id, name)
  values (v_org_id, v_name)
  returning id into v_local_id;

  return v_local_id;

exception
  when unique_violation then
    raise exception 'local already exists' using errcode = '23505';
end;
$$;

revoke all on function public.rpc_create_local(uuid, text) from public;
grant execute on function public.rpc_create_local(uuid, text) to authenticated;

-- Sanity checks (manual)
-- select public.rpc_create_local('<org_id>', 'Sucursal Demo');
-- select * from public.locals where org_id = '<org_id>' order by created_at desc;

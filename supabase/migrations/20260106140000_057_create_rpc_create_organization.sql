create or replace function public.rpc_create_organization(
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_org_id uuid;
  v_user_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'name required' using errcode = '22023';
  end if;

  if length(v_name) > 120 then
    raise exception 'name too long' using errcode = '22023';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Missing auth user' using errcode = '42501';
  end if;

  insert into public.organizations (
    name,
    created_by_user_id
  )
  values (
    v_name,
    v_user_id
  )
  returning id into v_org_id;

  return v_org_id;
end;
$$;

revoke all on function public.rpc_create_organization(text, text) from public;
grant execute on function public.rpc_create_organization(text, text) to authenticated;

-- Sanity checks (manual)
-- select public.rpc_create_organization('Org Demo', null);
-- select * from public.v_superadmin_organizations order by created_at desc limit 5;

create or replace function public.rpc_superadmin_add_org_admin(
  p_org_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_user_id uuid;
  v_membership_id uuid;
  v_org_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_org_id is null then
    raise exception 'org_id required' using errcode = '22023';
  end if;

  select o.id into v_org_id
  from public.organizations o
  where o.id = p_org_id;

  if v_org_id is null then
    raise exception 'org not found' using errcode = '22023';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    raise exception 'email required' using errcode = '22023';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.email) = v_email;

  if v_user_id is null then
    raise exception 'user not found' using errcode = '22023';
  end if;

  insert into public.org_memberships (org_id, user_id, role, status, ended_at)
  values (v_org_id, v_user_id, 'org_admin', 'active', null)
  on conflict (org_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    ended_at = null
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

create or replace function public.rpc_superadmin_set_org_membership_status(
  p_membership_id uuid,
  p_status membership_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_membership_id is null then
    raise exception 'membership_id required' using errcode = '22023';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.org_memberships
  set
    status = p_status,
    ended_at = case when p_status = 'inactive' then now() else null end
  where id = p_membership_id;

  if not found then
    raise exception 'membership not found' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.rpc_superadmin_add_local_member(
  p_local_id uuid,
  p_email text,
  p_role local_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_user_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_local_id is null then
    raise exception 'local_id required' using errcode = '22023';
  end if;

  select l.org_id into v_org_id
  from public.locals l
  where l.id = p_local_id;

  if v_org_id is null then
    raise exception 'local not found' using errcode = '22023';
  end if;

  if p_role not in ('aprendiz', 'referente') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    raise exception 'email required' using errcode = '22023';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.email) = v_email;

  if v_user_id is null then
    raise exception 'user not found' using errcode = '22023';
  end if;

  insert into public.local_memberships (
    org_id,
    local_id,
    user_id,
    role,
    status,
    ended_at
  )
  values (v_org_id, p_local_id, v_user_id, p_role, 'active', null)
  on conflict (local_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    ended_at = null,
    org_id = excluded.org_id
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

create or replace function public.rpc_superadmin_set_local_membership_status(
  p_membership_id uuid,
  p_status membership_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_membership_id is null then
    raise exception 'membership_id required' using errcode = '22023';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.local_memberships
  set
    status = p_status,
    ended_at = case when p_status = 'inactive' then now() else null end
  where id = p_membership_id;

  if not found then
    raise exception 'membership not found' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.rpc_superadmin_add_org_admin(uuid, text) from public;
grant execute on function public.rpc_superadmin_add_org_admin(uuid, text) to authenticated;

revoke all on function public.rpc_superadmin_set_org_membership_status(uuid, membership_status) from public;
grant execute on function public.rpc_superadmin_set_org_membership_status(uuid, membership_status) to authenticated;

revoke all on function public.rpc_superadmin_add_local_member(uuid, text, local_role) from public;
grant execute on function public.rpc_superadmin_add_local_member(uuid, text, local_role) to authenticated;

revoke all on function public.rpc_superadmin_set_local_membership_status(uuid, membership_status) from public;
grant execute on function public.rpc_superadmin_set_local_membership_status(uuid, membership_status) to authenticated;

-- Sanity checks (manual)
-- select public.rpc_superadmin_add_org_admin('<org_id>', 'admin@example.com');
-- select public.rpc_superadmin_set_org_membership_status('<membership_id>', 'inactive');
-- select public.rpc_superadmin_add_local_member('<local_id>', 'learner@example.com', 'aprendiz');
-- select public.rpc_superadmin_set_local_membership_status('<membership_id>', 'inactive');

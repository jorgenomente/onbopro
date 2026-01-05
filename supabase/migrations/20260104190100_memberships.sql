create table org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  role org_role not null,
  status membership_status not null default 'active',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index org_memberships_org_id_idx on org_memberships(org_id);
create index org_memberships_user_status_idx on org_memberships(user_id, status);
create index org_memberships_org_role_status_idx on org_memberships(org_id, role, status);

create table local_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  local_id uuid not null references locals(id),
  user_id uuid not null references auth.users(id),
  role local_role not null,
  status membership_status not null default 'active',
  is_primary boolean not null default false,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (local_id, user_id)
);

create unique index local_memberships_primary_active_uidx
  on local_memberships(org_id, user_id)
  where is_primary = true and status = 'active';

create index local_memberships_local_id_idx on local_memberships(local_id);
create index local_memberships_org_id_idx on local_memberships(org_id);
create index local_memberships_user_status_idx on local_memberships(user_id, status);
create index local_memberships_local_role_status_idx on local_memberships(local_id, role, status);
create index local_memberships_local_status_idx on local_memberships(local_id, status);

create or replace function rls_enforce_local_membership_org()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from locals l
    where l.id = new.local_id
      and l.org_id = new.org_id
  ) then
    raise exception 'local_memberships.org_id must match locals.org_id';
  end if;

  return new;
end;
$$;

create trigger trg_local_memberships_org
before insert or update on local_memberships
for each row
execute function rls_enforce_local_membership_org();

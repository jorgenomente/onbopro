create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  local_id uuid references locals(id),
  email text not null,
  invited_role invitation_role not null,
  status invitation_status not null default 'pending',
  token text not null,
  expires_at timestamptz not null,
  invited_by_user_id uuid not null references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (token)
);

create index invitations_org_id_idx on invitations(org_id);
create index invitations_email_idx on invitations(email);
create index invitations_status_idx on invitations(status);
